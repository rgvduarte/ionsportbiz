-- Aprovação pela equipa e tipos de acesso.
--
-- Fluxo: a equipa envia o convite → o convidado confirma presença → fica "por aprovar" → a equipa aprova
-- e escolhe o tipo de acesso (ex.: VIP, Conferência) → só então o convidado recebe o código QR e a lista
-- de acessos. A equipa também pode aprovar antes da resposta (ex.: convidados de honra): nesse caso o
-- convidado recebe a credencial assim que confirmar.
-- Eventos com requires_approval = false aprovam automaticamente quem confirma.

create type public.approval_status as enum ('pending', 'approved', 'rejected');

-- ───────────────────────────── Tipos de acesso ─────────────────────────────

create table public.pass_types (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null check (length(name) between 1 and 80),
  description text check (description is null or length(description) <= 500),
  -- O que este acesso inclui, pela ordem a mostrar: {"VIP Gala Dinner","Awards Ceremony","ion Conference"}
  accesses    text[] not null default '{}',
  color       text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  sort        integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (event_id, name)
);
create index pass_types_event_idx on public.pass_types (event_id, sort);

alter table public.pass_types enable row level security;
-- Toda a equipa lê (a receção mostra o tipo de acesso à porta); admin/editor escrevem.
create policy pass_types_read on public.pass_types for select to authenticated using (public.is_staff());
create policy pass_types_write on public.pass_types for all to authenticated using (public.can_edit()) with check (public.can_edit());
revoke all on public.pass_types from anon;

alter table public.events add column requires_approval boolean not null default true;

alter table public.invitations
  add column approval_status public.approval_status not null default 'pending',
  add column pass_type_id    uuid references public.pass_types (id) on delete set null,
  add column approved_at     timestamptz,
  add column approved_by     uuid references public.staff (user_id) on delete set null;
create index invitations_approval_idx on public.invitations (event_id, approval_status);

grant select (approval_status, pass_type_id, approved_at, approved_by) on public.invitations to authenticated;

-- O tipo de acesso tem de ser do mesmo evento que o convite.
create function public.check_pass_type_event() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.pass_type_id is not null and not exists (
    select 1 from public.pass_types p where p.id = new.pass_type_id and p.event_id = new.event_id) then
    raise exception 'invalid_pass_type';
  end if;
  return new;
end $$;
create trigger invitations_pass_type_event before insert or update of pass_type_id, event_id on public.invitations
  for each row execute function public.check_pass_type_event();

-- ───────────────────────────── Vista da lista de convidados ─────────────────────────────

create or replace view public.invitation_overview with (security_invoker = true) as
select i.id, i.event_id, i.contact_id, s.token, s.checkin_code,
       i.status, i.wave, i.plus_ones_allowed, i.invited_by, i.sent_at, i.sent_channel,
       i.first_opened_at, i.last_opened_at, i.open_count, i.responded_at, i.answers, i.guest_note,
       i.checked_in_at, i.checked_in_by, i.created_at, i.updated_at,
       c.salutation, c.first_name, c.last_name, c.email, c.phone, c.organization, c.job_title,
       c.segment, c.tags, c.language, c.marketing_consent,
       (select count(*) from public.companions m where m.invitation_id = i.id)::int as companions_count,
       (select count(*) from public.companions m where m.invitation_id = i.id and m.checked_in_at is not null)::int
         as companions_checked_in,
       i.approval_status, i.pass_type_id, p.name as pass_type_name, p.color as pass_type_color,
       i.approved_at, i.approved_by
from public.invitations i
join public.contacts c on c.id = i.contact_id
left join public.pass_types p on p.id = i.pass_type_id
left join lateral public.invitation_secret(i.id) s on true;

-- ───────────────────────────── Convidado ─────────────────────────────

-- Credencial (código QR) só com presença confirmada E aprovada pela equipa.
create or replace function public.guest_payload(p_invitation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object(
      'status', i.status,
      'approval_status', i.approval_status,
      'plus_ones_allowed', i.plus_ones_allowed,
      'answers', i.answers,
      'guest_note', i.guest_note,
      'responded_at', i.responded_at,
      'checked_in_at', i.checked_in_at,
      'checkin_code', case when i.status = 'accepted' and i.approval_status = 'approved' then i.checkin_code end,
      'pass_type', case when i.approval_status = 'approved' and p.id is not null then jsonb_build_object(
        'name', p.name, 'description', p.description, 'accesses', to_jsonb(p.accesses), 'color', p.color) end,
      'companions', coalesce((select jsonb_agg(jsonb_build_object('full_name', m.full_name) order by m.created_at)
                              from public.companions m where m.invitation_id = i.id), '[]')),
    'contact', jsonb_build_object(
      'salutation', c.salutation, 'first_name', c.first_name, 'last_name', c.last_name,
      'organization', c.organization, 'job_title', c.job_title,
      'language', c.language, 'marketing_consent', c.marketing_consent),
    'event', jsonb_build_object(
      'name', e.name, 'host_name', e.host_name, 'invitation_text', e.invitation_text,
      'description', e.description, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
      'venue_name', e.venue_name, 'venue_address', e.venue_address, 'venue_maps_url', e.venue_maps_url,
      'dress_code', e.dress_code, 'contact_email', e.contact_email, 'contact_phone', e.contact_phone,
      'rsvp_deadline', e.rsvp_deadline, 'rsvp_fields', e.rsvp_fields, 'branding', e.branding,
      'status', e.status, 'privacy_controller', e.privacy_controller,
      'privacy_policy_url', e.privacy_policy_url, 'marketing_consent_text', e.marketing_consent_text,
      'requires_approval', e.requires_approval,
      'rsvp_open', e.status = 'open' and (e.rsvp_deadline is null or now() <= e.rsvp_deadline)),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'title', s.title,
        'description', s.description, 'location', s.location, 'speakers', s.speakers) order by s.starts_at)
      from public.event_sessions s where s.event_id = e.id), '[]'))
  from public.invitations i
  join public.contacts c on c.id = i.contact_id
  join public.events e on e.id = i.event_id
  left join public.pass_types p on p.id = i.pass_type_id
  where i.id = p_invitation_id
$$;

create or replace function public.guest_respond(
  p_token text,
  p_accept boolean,
  p_answers jsonb default '{}',
  p_companions jsonb default '[]',      -- [{"full_name":"…"}]
  p_note text default null,
  p_marketing_consent boolean default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.invitations;
  e public.events;
  c public.contacts;
  v_companions text[];
  v_taken integer;
begin
  if p_token is null or length(p_token) <> 22 then
    raise exception 'not_found';
  end if;
  select i.* into v
  from public.invitations i join public.contacts ct on ct.id = i.contact_id
  where i.token = p_token and i.status <> 'cancelled' and ct.anonymized_at is null;
  if not found then
    raise exception 'not_found';
  end if;
  -- Bloqueia o evento: as verificações de lotação ficam em série.
  select * into e from public.events where id = v.event_id for update;
  if e.status not in ('open', 'closed') then
    raise exception 'not_found';
  end if;
  if e.status <> 'open' or (e.rsvp_deadline is not null and now() > e.rsvp_deadline) then
    raise exception 'rsvp_closed';
  end if;
  if v.checked_in_at is not null then
    raise exception 'already_checked_in';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or pg_column_size(p_answers) > 8192 then
    raise exception 'invalid_answers';
  end if;
  if p_note is not null and length(p_note) > 1000 then
    raise exception 'invalid_note';
  end if;
  if p_companions is null or jsonb_typeof(p_companions) <> 'array' then
    raise exception 'invalid_companions';
  end if;

  select coalesce(array_agg(btrim(x ->> 'full_name')), '{}') into v_companions
  from jsonb_array_elements(p_companions) as x;
  if not p_accept then
    v_companions := '{}';
  end if;
  if cardinality(v_companions) > v.plus_ones_allowed then
    raise exception 'too_many_companions';
  end if;
  if exists (select 1 from unnest(v_companions) n where n is null or length(n) not between 1 and 160) then
    raise exception 'invalid_companions';
  end if;

  -- Lotação: contam as presenças confirmadas que não foram recusadas pela equipa.
  if p_accept and e.capacity is not null then
    select coalesce(sum(1 + (select count(*) from public.companions m where m.invitation_id = i.id)), 0)
      into v_taken
    from public.invitations i
    where i.event_id = e.id and i.status = 'accepted' and i.approval_status <> 'rejected' and i.id <> v.id;
    if v_taken + 1 + cardinality(v_companions) > e.capacity then
      raise exception 'capacity_full';
    end if;
  end if;

  update public.invitations
     set status = case when p_accept then 'accepted'::public.invitation_status else 'declined' end,
         responded_at = now(),
         answers = case when p_accept then p_answers else '{}'::jsonb end,
         guest_note = nullif(btrim(p_note), ''),
         first_opened_at = coalesce(first_opened_at, now()),
         last_opened_at = coalesce(last_opened_at, now()),
         -- Sem aprovação obrigatória, quem confirma fica aprovado. Com aprovação, a decisão é da equipa.
         approval_status = case when p_accept and not e.requires_approval and approval_status = 'pending'
                                then 'approved'::public.approval_status else approval_status end,
         approved_at = case when p_accept and not e.requires_approval and approval_status = 'pending'
                            then now() else approved_at end
   where id = v.id;

  delete from public.companions where invitation_id = v.id;
  insert into public.companions (invitation_id, full_name)
  select v.id, n from unnest(v_companions) as n;

  -- Consentimento para comunicações futuras: só muda se o convidado o indicar.
  if p_marketing_consent is not null then
    select * into c from public.contacts where id = v.contact_id;
    if p_marketing_consent and not c.marketing_consent then
      update public.contacts
         set marketing_consent = true, marketing_consent_at = now(),
             marketing_consent_text = e.marketing_consent_text
       where id = c.id;
      perform public.log_activity('consent.granted', c.id, v.id, e.id, 'link',
                                  jsonb_build_object('text', e.marketing_consent_text));
    elsif not p_marketing_consent and c.marketing_consent then
      update public.contacts set marketing_consent = false where id = c.id;
      perform public.log_activity('consent.revoked', c.id, v.id, e.id, 'link', '{}');
    end if;
  end if;

  return public.guest_payload(v.id);
end $$;

-- ───────────────────────────── Equipa: aprovar e recusar ─────────────────────────────

-- Aprova convites com um tipo de acesso (do mesmo evento). Convites cancelados ou recusados pelo
-- convidado ficam de fora. Devolve quantos foram aprovados.
create function public.approve_invitations(p_invitation_ids uuid[], p_pass_type_id uuid) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  n integer;
  p public.pass_types;
begin
  if not public.can_edit() then
    raise exception 'forbidden';
  end if;
  select * into p from public.pass_types where id = p_pass_type_id;
  if not found or exists (select 1 from public.invitations i
                          where i.id = any (p_invitation_ids) and i.event_id <> p.event_id) then
    raise exception 'invalid_pass_type';
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

create function public.reject_invitations(p_invitation_ids uuid[], p_reason text default null) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  n integer;
begin
  if not public.can_edit() then
    raise exception 'forbidden';
  end if;
  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'validation';
  end if;
  with changed as (
    update public.invitations i
       set approval_status = 'rejected', pass_type_id = null, approved_at = null, approved_by = auth.uid()
     where i.id = any (p_invitation_ids) and i.approval_status <> 'rejected' and i.checked_in_at is null
    returning i.id, i.contact_id, i.event_id
  ), logged as (
    insert into public.activities (kind, contact_id, invitation_id, event_id, detail, actor_id)
    select 'invitation.rejected', c.contact_id, c.id, c.event_id,
           case when nullif(btrim(p_reason), '') is null then '{}'::jsonb
                else jsonb_build_object('reason', btrim(p_reason)) end, auth.uid()
    from changed c
    returning 1
  )
  select count(*) into n from logged;
  return n;
end $$;

-- Volta a pôr convites em "por aprovar" (ex.: aprovação feita por engano).
create function public.reset_approval(p_invitation_ids uuid[]) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  n integer;
begin
  if not public.can_edit() then
    raise exception 'forbidden';
  end if;
  with changed as (
    update public.invitations i
       set approval_status = 'pending', pass_type_id = null, approved_at = null, approved_by = null
     where i.id = any (p_invitation_ids) and i.approval_status <> 'pending' and i.checked_in_at is null
    returning i.id, i.contact_id, i.event_id
  ), logged as (
    insert into public.activities (kind, contact_id, invitation_id, event_id, actor_id)
    select 'invitation.approval_reset', c.contact_id, c.id, c.event_id, auth.uid() from changed c
    returning 1
  )
  select count(*) into n from logged;
  return n;
end $$;

-- ───────────────────────────── Painel ─────────────────────────────

create or replace function public.event_stats(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
  v_crm boolean := public.can_read_crm();
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  with inv as (
    select i.*, c.segment,
           (select count(*) from public.companions m where m.invitation_id = i.id)::int as comp,
           (select count(*) from public.companions m where m.invitation_id = i.id and m.checked_in_at is not null)::int as comp_in
    from public.invitations i join public.contacts c on c.id = i.contact_id
    where i.event_id = p_event_id and i.status <> 'cancelled'
  )
  select jsonb_build_object(
    'invited', count(*),
    'by_status', jsonb_build_object(
      'draft', count(*) filter (where status = 'draft'),
      'sent', count(*) filter (where status = 'sent'),
      'opened', count(*) filter (where status = 'opened'),
      'accepted', count(*) filter (where status = 'accepted'),
      'declined', count(*) filter (where status = 'declined')),
    'delivered', count(*) filter (where status <> 'draft'),
    'opened', count(*) filter (where first_opened_at is not null),
    'responded', count(*) filter (where status in ('accepted', 'declined')),
    'expected_attendees', coalesce(sum(1 + comp) filter (where status = 'accepted' and approval_status <> 'rejected'), 0),
    'checked_in', coalesce(count(*) filter (where checked_in_at is not null), 0) + coalesce(sum(comp_in), 0),
    'capacity', (select capacity from public.events where id = p_event_id),
    -- Aprovação: só conta quem confirmou presença.
    'approval', jsonb_build_object(
      'pending', count(*) filter (where status = 'accepted' and approval_status = 'pending'),
      'approved', count(*) filter (where status = 'accepted' and approval_status = 'approved'),
      'rejected', count(*) filter (where status = 'accepted' and approval_status = 'rejected')),
    'by_pass_type', coalesce((select jsonb_agg(t order by (t ->> 'sort')::int, t ->> 'name') from (
        select jsonb_build_object('pass_type_id', p.id, 'name', p.name, 'color', p.color, 'sort', p.sort,
          'approved', count(x.id) filter (where x.status = 'accepted'),
          'attendees', coalesce(sum(1 + x.comp) filter (where x.status = 'accepted'), 0)) as t
        from public.pass_types p
        left join inv x on x.pass_type_id = p.id and x.approval_status = 'approved'
        where p.event_id = p_event_id
        group by p.id) z), '[]'),
    'by_wave', case when v_crm then coalesce((select jsonb_agg(w order by w ->> 'wave') from (
        select jsonb_build_object('wave', coalesce(wave, ''), 'invited', count(*),
          'accepted', count(*) filter (where status = 'accepted'),
          'declined', count(*) filter (where status = 'declined')) as w
        from inv group by wave) x), '[]') else '[]' end,
    'by_segment', case when v_crm then coalesce((select jsonb_agg(s order by s ->> 'segment') from (
        select jsonb_build_object('segment', coalesce(segment, ''), 'invited', count(*),
          'accepted', count(*) filter (where status = 'accepted'),
          'declined', count(*) filter (where status = 'declined')) as s
        from inv group by segment) y), '[]') else '[]' end)
  into result
  from inv;
  return result;
end $$;

-- ───────────────────────────── Check-in ─────────────────────────────

create or replace function public.checkin_record(p_invitation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'invitation_id', i.id, 'event_id', i.event_id, 'event_name', e.name,
    'salutation', c.salutation, 'first_name', c.first_name, 'last_name', c.last_name,
    'organization', c.organization, 'status', i.status, 'wave', i.wave,
    'approval_status', i.approval_status,
    'pass_type', case when p.id is not null then jsonb_build_object(
      'name', p.name, 'color', p.color, 'accesses', to_jsonb(p.accesses)) end,
    'plus_ones_allowed', i.plus_ones_allowed, 'checked_in_at', i.checked_in_at,
    'companions', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'full_name', m.full_name,
                                                                 'checked_in_at', m.checked_in_at) order by m.created_at)
                            from public.companions m where m.invitation_id = i.id), '[]'))
  from public.invitations i
  join public.contacts c on c.id = i.contact_id
  join public.events e on e.id = i.event_id
  left join public.pass_types p on p.id = i.pass_type_id and i.approval_status = 'approved'
  where i.id = p_invitation_id
$$;

-- Sem p_force, só entra quem confirmou presença e foi aprovado pela equipa.
create or replace function public.check_in(p_invitation_id uuid, p_companion_ids uuid[] default '{}', p_force boolean default false)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  if not public.can_check_in() then
    raise exception 'forbidden';
  end if;
  select * into v from public.invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v.status <> 'accepted' and not p_force then
    raise exception 'not_accepted';
  end if;
  if v.approval_status <> 'approved' and not p_force then
    raise exception 'not_approved';
  end if;
  if v.checked_in_at is null then
    update public.invitations set checked_in_at = now(), checked_in_by = auth.uid() where id = v.id;
    perform public.log_activity('checkin', v.contact_id, v.id, v.event_id, null,
                                jsonb_build_object('status', v.status, 'approval_status', v.approval_status,
                                                   'forced', v.status <> 'accepted' or v.approval_status <> 'approved'));
  end if;
  update public.companions set checked_in_at = now()
   where invitation_id = v.id and id = any (coalesce(p_companion_ids, '{}')) and checked_in_at is null;
  return public.checkin_record(v.id);
end $$;

-- ───────────────────────────── Permissões ─────────────────────────────

revoke execute on function public.approve_invitations(uuid[], uuid) from public, anon;
revoke execute on function public.reject_invitations(uuid[], text) from public, anon;
revoke execute on function public.reset_approval(uuid[]) from public, anon;
revoke execute on function public.check_pass_type_event() from public, anon, authenticated;
grant execute on function public.approve_invitations(uuid[], uuid) to authenticated;
grant execute on function public.reject_invitations(uuid[], text) to authenticated;
grant execute on function public.reset_approval(uuid[]) to authenticated;
-- create or replace mantém as permissões; reafirma-se o essencial.
revoke execute on function public.guest_payload(uuid) from public, anon, authenticated;
revoke execute on function public.checkin_record(uuid) from public, anon, authenticated;
grant execute on function public.guest_respond(text, boolean, jsonb, jsonb, text, boolean) to anon, authenticated;
grant execute on function public.event_stats(uuid) to authenticated;
grant execute on function public.check_in(uuid, uuid[], boolean) to authenticated;
