-- Quotas por tipo de acesso e tipo de acesso definido logo ao convidar.
--
--   pass_types.capacity      máximo de convites aprovados com este tipo (null = sem limite).
--                            Conta quem está aprovado e não recusou nem foi cancelado, incluindo os
--                            pré-aprovados que ainda não responderam (a credencial já lhes foi prometida).
--                            Os acompanhantes não contam: a quota é de credenciais, decidida pela equipa,
--                            e nunca bloqueia a resposta do convidado.
--   approve_invitations      recusa ('pass_quota') o que ultrapassaria a quota.
--   invite_contacts          convida contactos e, opcionalmente, pré-aprova-os com um tipo de acesso,
--                            numa só transação (se a quota não chegar, nenhum convite é criado).
--   import_contacts          ganha p_pass_type_id com o mesmo efeito para os convites da importação.

alter table public.pass_types
  add column capacity integer check (capacity is null or capacity between 1 and 100000);

comment on column public.pass_types.capacity is
  'Máximo de convites aprovados com este tipo de acesso (pré-aprovados incluídos, acompanhantes não). Null = sem limite.';

-- ───────────────────────────── Aprovação com quota ─────────────────────────────

create or replace function public.approve_invitations(p_invitation_ids uuid[], p_pass_type_id uuid) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  n integer;
  p public.pass_types;
  v_new integer;
  v_used integer;
begin
  if not public.can_edit() then
    raise exception 'forbidden';
  end if;
  -- for update: duas aprovações em simultâneo para o mesmo tipo esperam uma pela outra (a quota não fura).
  select * into p from public.pass_types where id = p_pass_type_id for update;
  if not found or exists (select 1 from public.invitations i
                          where i.id = any (p_invitation_ids) and i.event_id <> p.event_id) then
    raise exception 'invalid_pass_type';
  end if;
  if p.capacity is not null then
    select count(*) into v_new from public.invitations i
     where i.id = any (p_invitation_ids) and i.event_id = p.event_id and i.status not in ('cancelled', 'declined')
       and (i.approval_status <> 'approved' or i.pass_type_id is distinct from p.id);
    select count(*) into v_used from public.invitations i
     where i.pass_type_id = p.id and i.approval_status = 'approved' and i.status not in ('cancelled', 'declined');
    if v_new > 0 and v_used + v_new > p.capacity then
      raise exception 'pass_quota' using detail = jsonb_build_object(
        'pass_type', p.name, 'capacity', p.capacity, 'used', v_used, 'requested', v_new)::text;
    end if;
  end if;
  with changed as (
    update public.invitations i
       set approval_status = 'approved', pass_type_id = p.id, approved_at = now(), approved_by = auth.uid()
     where i.id = any (p_invitation_ids) and i.event_id = p.event_id and i.status not in ('cancelled', 'declined')
       and (i.approval_status <> 'approved' or i.pass_type_id is distinct from p.id)
    returning i.id, i.contact_id, i.event_id
  ), logged as (
    insert into public.activities (kind, contact_id, invitation_id, event_id, detail, actor_id)
    select 'invitation.approved', c.contact_id, c.id, c.event_id, jsonb_build_object('pass_type', p.name), auth.uid()
    from changed c
    returning 1
  )
  select count(*) into n from logged;
  return n;
end $$;

-- ───────────────────────────── Convidar (com pré-aprovação opcional) ─────────────────────────────

create function public.invite_contacts(
  p_event_id uuid, p_contact_ids uuid[], p_wave text default null, p_plus_ones integer default null,
  p_pass_type_id uuid default null
) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_plus integer;
  v_ids uuid[];
begin
  if not public.can_edit() then
    raise exception 'forbidden';
  end if;
  if coalesce(cardinality(p_contact_ids), 0) > 5000 or (p_plus_ones is not null and p_plus_ones not between 0 and 20) then
    raise exception 'validation';
  end if;
  select coalesce(p_plus_ones, default_plus_ones) into v_plus from public.events where id = p_event_id;
  if not found then
    raise exception 'not_found';
  end if;
  with ins as (
    insert into public.invitations (event_id, contact_id, wave, plus_ones_allowed)
    select p_event_id, c.id, nullif(btrim(p_wave), ''), v_plus
      from public.contacts c
     where c.id = any (p_contact_ids) and c.anonymized_at is null
    on conflict (event_id, contact_id) do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_ids from ins;
  -- Pré-aprovação: se o tipo não for deste evento ou a quota não chegar, a exceção desfaz também os convites.
  if p_pass_type_id is not null and cardinality(v_ids) > 0 then
    perform public.approve_invitations(v_ids, p_pass_type_id);
  end if;
  return cardinality(v_ids);
end $$;

-- ───────────────────────────── Importar (com pré-aprovação opcional) ─────────────────────────────
-- A assinatura muda (novo parâmetro): remove-se a anterior para não haver duas versões.

drop function public.import_contacts(jsonb, uuid, text, integer);

create function public.import_contacts(
  p_rows jsonb, p_event_id uuid default null, p_wave text default null, p_plus_ones integer default null,
  p_pass_type_id uuid default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r jsonb;
  idx integer := 0;
  v_id uuid;
  v_inv uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_invited integer := 0;
  v_errors jsonb := '[]';
  v_plus integer;
  v_new uuid[] := '{}';
begin
  if not public.can_edit() then
    raise exception 'forbidden';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 5000 then
    raise exception 'invalid_rows';
  end if;
  if p_event_id is not null then
    select coalesce(p_plus_ones, default_plus_ones) into v_plus from public.events where id = p_event_id;
    if not found then
      raise exception 'not_found';
    end if;
  end if;
  if p_pass_type_id is not null and (p_event_id is null or not exists (
       select 1 from public.pass_types where id = p_pass_type_id and event_id = p_event_id)) then
    raise exception 'invalid_pass_type';
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    idx := idx + 1;
    begin
      if coalesce(btrim(r ->> 'first_name'), '') = '' then
        raise exception 'Falta o nome';
      end if;
      v_id := null;
      if nullif(btrim(r ->> 'email'), '') is not null then
        select id into v_id from public.contacts
         where email = lower(btrim(r ->> 'email')) and anonymized_at is null
         order by created_at limit 1;
      elsif nullif(btrim(r ->> 'phone'), '') is not null then
        select id into v_id from public.contacts
         where phone = regexp_replace(r ->> 'phone', '[\s().-]', '', 'g') and anonymized_at is null
         order by created_at limit 1;
      end if;

      if v_id is null then
        insert into public.contacts (salutation, first_name, last_name, email, phone, organization, job_title,
                                     segment, tags, language, notes, source)
        values (r ->> 'salutation', r ->> 'first_name', r ->> 'last_name', r ->> 'email', r ->> 'phone',
                r ->> 'organization', r ->> 'job_title', r ->> 'segment',
                coalesce((select array_agg(t) from jsonb_array_elements_text(coalesce(r -> 'tags', '[]')) t), '{}'),
                coalesce(nullif(r ->> 'language', ''), 'pt'), r ->> 'notes', 'importação')
        returning id into v_id;
        v_inserted := v_inserted + 1;
      else
        update public.contacts c set
          salutation   = coalesce(c.salutation, nullif(r ->> 'salutation', '')),
          last_name    = coalesce(c.last_name, nullif(r ->> 'last_name', '')),
          email        = coalesce(c.email, nullif(r ->> 'email', '')),
          phone        = coalesce(c.phone, nullif(r ->> 'phone', '')),
          organization = coalesce(c.organization, nullif(r ->> 'organization', '')),
          job_title    = coalesce(c.job_title, nullif(r ->> 'job_title', '')),
          segment      = coalesce(c.segment, nullif(r ->> 'segment', '')),
          tags         = c.tags || coalesce((select array_agg(t) from jsonb_array_elements_text(coalesce(r -> 'tags', '[]')) t), '{}'),
          notes        = coalesce(c.notes, nullif(r ->> 'notes', ''))
        where c.id = v_id;
        v_updated := v_updated + 1;
      end if;

      if p_event_id is not null then
        v_inv := null;
        insert into public.invitations (event_id, contact_id, wave, plus_ones_allowed)
        values (p_event_id, v_id, nullif(btrim(p_wave), ''), v_plus)
        on conflict (event_id, contact_id) do nothing
        returning id into v_inv;
        if v_inv is not null then
          v_invited := v_invited + 1;
          v_new := v_new || v_inv;
        end if;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', idx, 'message', sqlerrm);
    end;
  end loop;

  -- Pré-aprovação dos convites novos. Fora do ciclo: se a quota não chegar, toda a importação é desfeita.
  if p_pass_type_id is not null and cardinality(v_new) > 0 then
    perform public.approve_invitations(v_new, p_pass_type_id);
  end if;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'invited', v_invited,
                            'errors', v_errors);
end $$;

-- ───────────────────────────── Permissões ─────────────────────────────

revoke execute on function public.invite_contacts(uuid, uuid[], text, integer, uuid) from public, anon;
revoke execute on function public.import_contacts(jsonb, uuid, text, integer, uuid) from public, anon;
grant execute on function public.invite_contacts(uuid, uuid[], text, integer, uuid) to authenticated;
grant execute on function public.import_contacts(jsonb, uuid, text, integer, uuid) to authenticated;
-- create or replace mantém as permissões; reafirma-se o essencial.
revoke execute on function public.approve_invitations(uuid[], uuid) from public, anon;
grant execute on function public.approve_invitations(uuid[], uuid) to authenticated;
