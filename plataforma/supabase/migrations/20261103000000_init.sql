-- Plataforma de convites: esquema inicial.
--
-- Modelo:
--   staff            equipa com acesso ao back-office (liga a auth.users)
--   events           eventos (um evento = uma lista de convidados)
--   event_sessions   programa do evento
--   contacts         CRM: pessoas, reutilizáveis entre eventos
--   invitations      convite de uma pessoa para um evento (link pessoal + código de check-in)
--   companions       acompanhantes (+1) indicados pelo convidado
--   activities       linha do tempo e auditoria (só se acrescenta, nunca se altera)
--   message_templates / deliveries   modelos e registo de envios
--
-- Segurança:
--   * RLS em todas as tabelas. O papel anon não lê nenhuma tabela.
--   * O convidado não tem conta: o link pessoal (token aleatório de 122 bits) é a credencial,
--     e só funciona através das funções guest_* (security definer).
--   * O papel "checkin" (staff da porta) não lê o CRM: só vê nome, entidade e estado,
--     através das funções checkin_*.

-- ───────────────────────────── Tipos ─────────────────────────────

create type public.staff_role as enum ('admin', 'editor', 'checkin', 'viewer');
create type public.event_status as enum ('draft', 'open', 'closed', 'archived');
create type public.invitation_status as enum ('draft', 'sent', 'opened', 'accepted', 'declined', 'cancelled');
create type public.channel as enum ('email', 'whatsapp', 'sms', 'manual', 'link');

-- ───────────────────────────── Utilitários ─────────────────────────────

-- Token do link pessoal: 22 caracteres base64url (122 bits aleatórios do UUID v4).
create function public.new_token() returns text
language sql volatile set search_path = '' as $$
  select translate(rtrim(encode(uuid_send(gen_random_uuid()), 'base64'), '='), '+/', '-_')
$$;

-- Código de check-in: 10 caracteres sem ambiguidades (sem 0/O, 1/I/L), ~49 bits.
-- Só a equipa o pode usar (funções checkin_*), por isso não precisa de ser tão longo como o token.
create function public.new_checkin_code() returns text
language sql volatile set search_path = '' as $$
  -- Salta os bytes 6 e 8 do UUID v4, que têm bits fixos (versão e variante).
  select string_agg(substr('23456789ABCDEFGHJKMNPQRSTUVWXYZ', (get_byte(b, p.pos) % 31) + 1, 1), '' order by p.n)
  from (select uuid_send(gen_random_uuid()) as b) r,
       unnest(array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12]) with ordinality as p(pos, n)
$$;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ───────────────────────────── Equipa ─────────────────────────────

create table public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (length(full_name) between 1 and 120),
  email      text not null,
  role       public.staff_role not null default 'viewer',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create function public.staff_role_of_current_user() returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select role from public.staff where user_id = auth.uid() and active
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.staff_role_of_current_user() is not null
$$;

-- Lê o CRM (admin, editor, viewer). A equipa de check-in fica de fora.
create function public.can_read_crm() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.staff_role_of_current_user() in ('admin', 'editor', 'viewer'), false)
$$;

create function public.can_edit() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.staff_role_of_current_user() in ('admin', 'editor'), false)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.staff_role_of_current_user() = 'admin', false)
$$;

create function public.can_check_in() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.staff_role_of_current_user() in ('admin', 'editor', 'checkin'), false)
$$;

-- Nunca deixar a plataforma sem um administrador ativo.
create function public.keep_one_admin() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'DELETE' and old.role = 'admin' and old.active)
     or (tg_op = 'UPDATE' and old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active)) then
    if not exists (select 1 from public.staff
                   where role = 'admin' and active and user_id <> old.user_id) then
      raise exception 'last_admin' using hint = 'Tem de existir pelo menos um administrador ativo.';
    end if;
  end if;
  return coalesce(new, old);
end $$;

create trigger staff_keep_one_admin before update or delete on public.staff
  for each row execute function public.keep_one_admin();

-- ───────────────────────────── Eventos ─────────────────────────────

create table public.events (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  name                   text not null check (length(name) between 1 and 160),
  host_name              text,          -- quem convida, ex.: "O Conselho de Administração"
  invitation_text        text,          -- texto formal do convite
  description            text,
  starts_at              timestamptz not null,
  ends_at                timestamptz check (ends_at is null or ends_at >= starts_at),
  timezone               text not null default 'Europe/Lisbon',
  venue_name             text,
  venue_address          text,
  venue_maps_url         text,
  dress_code             text,
  contact_email          text,
  contact_phone          text,
  rsvp_deadline          timestamptz,
  capacity               integer check (capacity is null or capacity > 0),
  default_plus_ones      integer not null default 0 check (default_plus_ones between 0 and 10),
  status                 public.event_status not null default 'draft',
  -- Campos extra do formulário de resposta:
  -- [{"key":"dieta","label":"Restrições alimentares","type":"text|textarea|select|checkbox","options":[],"required":false}]
  rsvp_fields            jsonb not null default '[]' check (jsonb_typeof(rsvp_fields) = 'array'),
  branding               jsonb not null default '{}' check (jsonb_typeof(branding) = 'object'),  -- {"accent":"#1f3a5f","logo_url":"…"}
  privacy_controller     text,          -- responsável pelo tratamento dos dados (RGPD)
  privacy_policy_url     text,
  marketing_consent_text text,          -- texto da caixa de consentimento para comunicações futuras
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

create table public.event_sessions (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz check (ends_at is null or ends_at >= starts_at),
  title       text not null check (length(title) between 1 and 200),
  description text,
  location    text,
  speakers    text,
  created_at  timestamptz not null default now()
);
create index event_sessions_event_idx on public.event_sessions (event_id, starts_at);

-- ───────────────────────────── CRM ─────────────────────────────

create table public.contacts (
  id                     uuid primary key default gen_random_uuid(),
  salutation             text,          -- tratamento: "Exmo. Senhor", "Dra.", …
  first_name             text not null check (length(first_name) between 1 and 120),
  last_name              text,
  email                  text check (email is null or (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone                  text check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),  -- E.164
  organization           text,
  job_title              text,
  segment                text,
  tags                   text[] not null default '{}',
  language               text not null default 'pt' check (language in ('pt', 'en')),
  notes                  text,
  owner_id               uuid references public.staff (user_id) on delete set null,
  source                 text,          -- manual, importação, …
  marketing_consent      boolean not null default false,
  marketing_consent_at   timestamptz,
  marketing_consent_text text,
  anonymized_at          timestamptz,
  created_by             uuid default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
-- O email não é único: uma assessoria pode gerir os convites de várias pessoas.
create index contacts_email_idx on public.contacts (email);
create index contacts_phone_idx on public.contacts (phone);
create index contacts_name_idx on public.contacts (lower(last_name), lower(first_name));
create index contacts_tags_idx on public.contacts using gin (tags);

-- Normaliza antes de gravar: espaços, email em minúsculas, tags sem repetidos.
create function public.normalize_contact() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.first_name   := btrim(new.first_name);
  new.last_name    := nullif(btrim(new.last_name), '');
  new.salutation   := nullif(btrim(new.salutation), '');
  new.email        := nullif(lower(btrim(new.email)), '');
  new.phone        := nullif(regexp_replace(new.phone, '[\s().-]', '', 'g'), '');
  new.organization := nullif(btrim(new.organization), '');
  new.job_title    := nullif(btrim(new.job_title), '');
  new.segment      := nullif(btrim(new.segment), '');
  new.tags         := coalesce((select array_agg(distinct btrim(t) order by btrim(t))
                                from unnest(new.tags) as t where btrim(t) <> ''), '{}');
  if new.marketing_consent and (tg_op = 'INSERT' or not old.marketing_consent) then
    new.marketing_consent_at := coalesce(new.marketing_consent_at, now());
  elsif not new.marketing_consent then
    new.marketing_consent_at := null;
    new.marketing_consent_text := null;
  end if;
  return new;
end $$;

create trigger contacts_normalize before insert or update on public.contacts
  for each row execute function public.normalize_contact();
create trigger contacts_touch before update on public.contacts
  for each row execute function public.touch_updated_at();

-- ───────────────────────────── Convites ─────────────────────────────

create table public.invitations (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events (id) on delete cascade,
  contact_id        uuid not null references public.contacts (id) on delete cascade,
  token             text not null unique default public.new_token(),
  checkin_code      text not null unique default public.new_checkin_code(),
  status            public.invitation_status not null default 'draft',
  wave              text,               -- vaga ou lista: "VIP", "1.ª vaga", …
  plus_ones_allowed integer not null default 0 check (plus_ones_allowed between 0 and 10),
  invited_by        uuid default auth.uid() references public.staff (user_id) on delete set null,
  sent_at           timestamptz,
  sent_channel      public.channel,
  first_opened_at   timestamptz,
  last_opened_at    timestamptz,
  open_count        integer not null default 0,
  responded_at      timestamptz,
  answers           jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  guest_note        text check (guest_note is null or length(guest_note) <= 1000),
  checked_in_at     timestamptz,
  checked_in_by     uuid references public.staff (user_id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (event_id, contact_id)
);
create index invitations_event_status_idx on public.invitations (event_id, status);
create index invitations_contact_idx on public.invitations (contact_id);

create trigger invitations_touch before update on public.invitations
  for each row execute function public.touch_updated_at();

create table public.companions (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  full_name     text not null check (length(full_name) between 1 and 160),
  checked_in_at timestamptz,
  created_at    timestamptz not null default now()
);
create index companions_invitation_idx on public.companions (invitation_id);

-- ───────────────────────────── Linha do tempo ─────────────────────────────

create table public.activities (
  id            bigint generated always as identity primary key,
  contact_id    uuid references public.contacts (id) on delete cascade,
  invitation_id uuid references public.invitations (id) on delete cascade,
  event_id      uuid references public.events (id) on delete cascade,
  -- contact.created, contact.anonymized, invitation.created, invitation.sent, invitation.opened,
  -- invitation.resent, invitation.accepted, invitation.declined, invitation.cancelled, invitation.reopened,
  -- checkin, checkin.undone, consent.granted, consent.revoked, privacy.erasure_requested, note
  kind          text not null,
  channel       public.channel,
  detail        jsonb not null default '{}',
  actor_id      uuid,                   -- membro da equipa; null = convidado ou sistema
  created_at    timestamptz not null default now()
);
create index activities_contact_idx on public.activities (contact_id, created_at desc);
create index activities_event_idx on public.activities (event_id, created_at desc);

create function public.log_activity(
  p_kind text, p_contact uuid, p_invitation uuid, p_event uuid,
  p_channel public.channel default null, p_detail jsonb default '{}'
) returns void
language sql security definer set search_path = '' as $$
  insert into public.activities (kind, contact_id, invitation_id, event_id, channel, detail, actor_id)
  values (p_kind, p_contact, p_invitation, p_event, p_channel, coalesce(p_detail, '{}'), auth.uid())
$$;

create function public.contacts_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.log_activity('contact.created', new.id, null, null, null,
                              jsonb_build_object('source', new.source));
  return new;
end $$;
create trigger contacts_log after insert on public.contacts
  for each row execute function public.contacts_log();

create function public.invitations_log() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('invitation.created', new.contact_id, new.id, new.event_id, null,
                                jsonb_build_object('wave', new.wave));
  elsif new.status is distinct from old.status then
    perform public.log_activity(
      case new.status
        when 'sent' then 'invitation.sent'
        when 'opened' then 'invitation.opened'
        when 'accepted' then 'invitation.accepted'
        when 'declined' then 'invitation.declined'
        when 'cancelled' then 'invitation.cancelled'
        else 'invitation.reopened'
      end,
      new.contact_id, new.id, new.event_id,
      case when new.status = 'sent' then new.sent_channel end,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;
create trigger invitations_log after insert or update on public.invitations
  for each row execute function public.invitations_log();

-- ───────────────────────────── Mensagens ─────────────────────────────

create table public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events (id) on delete cascade,
  channel    public.channel not null check (channel in ('email', 'whatsapp', 'sms')),
  name       text not null check (length(name) between 1 and 120),
  subject    text,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger message_templates_touch before update on public.message_templates
  for each row execute function public.touch_updated_at();

create table public.deliveries (
  id                  uuid primary key default gen_random_uuid(),
  invitation_id       uuid not null references public.invitations (id) on delete cascade,
  channel             public.channel not null,
  template_id         uuid references public.message_templates (id) on delete set null,
  status              text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error               text,
  created_by          uuid default auth.uid(),
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);
create index deliveries_invitation_idx on public.deliveries (invitation_id, created_at desc);

-- ───────────────────────────── Vistas ─────────────────────────────

-- Lista de convidados de um evento, com os dados do contacto (respeita a RLS de quem consulta).
create view public.invitation_overview with (security_invoker = true) as
select i.*,
       c.salutation, c.first_name, c.last_name, c.email, c.phone, c.organization, c.job_title,
       c.segment, c.tags, c.language, c.marketing_consent,
       (select count(*) from public.companions m where m.invitation_id = i.id)::int as companions_count,
       (select count(*) from public.companions m where m.invitation_id = i.id and m.checked_in_at is not null)::int
         as companions_checked_in
from public.invitations i
join public.contacts c on c.id = i.contact_id;

-- ───────────────────────────── RLS ─────────────────────────────

alter table public.staff enable row level security;
alter table public.events enable row level security;
alter table public.event_sessions enable row level security;
alter table public.contacts enable row level security;
alter table public.invitations enable row level security;
alter table public.companions enable row level security;
alter table public.activities enable row level security;
alter table public.message_templates enable row level security;
alter table public.deliveries enable row level security;

create policy staff_read on public.staff for select to authenticated using (public.is_staff());
create policy staff_admin_insert on public.staff for insert to authenticated with check (public.is_admin());
create policy staff_admin_update on public.staff for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy staff_admin_delete on public.staff for delete to authenticated using (public.is_admin());

-- Eventos e programa: toda a equipa lê (o check-in precisa do nome e da data); admin/editor escrevem.
create policy events_read on public.events for select to authenticated using (public.is_staff());
create policy events_write on public.events for all to authenticated using (public.can_edit()) with check (public.can_edit());
create policy sessions_read on public.event_sessions for select to authenticated using (public.is_staff());
create policy sessions_write on public.event_sessions for all to authenticated using (public.can_edit()) with check (public.can_edit());

-- CRM: admin/editor/viewer leem; admin/editor escrevem. O check-in usa só as funções checkin_*.
create policy contacts_read on public.contacts for select to authenticated using (public.can_read_crm());
create policy contacts_write on public.contacts for all to authenticated using (public.can_edit()) with check (public.can_edit());
create policy invitations_read on public.invitations for select to authenticated using (public.can_read_crm());
create policy invitations_write on public.invitations for all to authenticated using (public.can_edit()) with check (public.can_edit());
create policy companions_read on public.companions for select to authenticated using (public.can_read_crm());
create policy companions_write on public.companions for all to authenticated using (public.can_edit()) with check (public.can_edit());
create policy templates_read on public.message_templates for select to authenticated using (public.can_read_crm());
create policy templates_write on public.message_templates for all to authenticated using (public.can_edit()) with check (public.can_edit());
create policy deliveries_read on public.deliveries for select to authenticated using (public.can_read_crm());
create policy deliveries_write on public.deliveries for insert to authenticated with check (public.can_edit());

-- Linha do tempo: só se acrescentam notas; o resto é escrito pelos triggers e funções.
create policy activities_read on public.activities for select to authenticated using (public.can_read_crm());
create policy activities_note on public.activities for insert to authenticated
  with check (public.can_edit() and kind = 'note' and actor_id = auth.uid());

-- Defesa em profundidade: o anon não toca em tabelas, mesmo que alguém desligue a RLS.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- ───────────────────────────── Funções do convidado (anon) ─────────────────────────────

-- O que o convidado vê. Nunca inclui notas internas, tags, segmento, email ou telefone.
create function public.guest_payload(p_invitation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object(
      'status', i.status,
      'plus_ones_allowed', i.plus_ones_allowed,
      'answers', i.answers,
      'guest_note', i.guest_note,
      'responded_at', i.responded_at,
      'checked_in_at', i.checked_in_at,
      -- O código de check-in só aparece depois de confirmar presença.
      'checkin_code', case when i.status = 'accepted' then i.checkin_code end,
      'companions', coalesce((select jsonb_agg(jsonb_build_object('full_name', m.full_name) order by m.created_at)
                              from public.companions m where m.invitation_id = i.id), '[]')),
    'contact', jsonb_build_object(
      'salutation', c.salutation, 'first_name', c.first_name, 'last_name', c.last_name,
      'language', c.language, 'marketing_consent', c.marketing_consent),
    'event', jsonb_build_object(
      'name', e.name, 'host_name', e.host_name, 'invitation_text', e.invitation_text,
      'description', e.description, 'starts_at', e.starts_at, 'ends_at', e.ends_at, 'timezone', e.timezone,
      'venue_name', e.venue_name, 'venue_address', e.venue_address, 'venue_maps_url', e.venue_maps_url,
      'dress_code', e.dress_code, 'contact_email', e.contact_email, 'contact_phone', e.contact_phone,
      'rsvp_deadline', e.rsvp_deadline, 'rsvp_fields', e.rsvp_fields, 'branding', e.branding,
      'status', e.status, 'privacy_controller', e.privacy_controller,
      'privacy_policy_url', e.privacy_policy_url, 'marketing_consent_text', e.marketing_consent_text,
      'rsvp_open', e.status = 'open' and (e.rsvp_deadline is null or now() <= e.rsvp_deadline)),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'starts_at', s.starts_at, 'ends_at', s.ends_at, 'title', s.title,
        'description', s.description, 'location', s.location, 'speakers', s.speakers) order by s.starts_at)
      from public.event_sessions s where s.event_id = e.id), '[]'))
  from public.invitations i
  join public.contacts c on c.id = i.contact_id
  join public.events e on e.id = i.event_id
  where i.id = p_invitation_id
$$;

-- Abre o convite a partir do link pessoal. Regista a abertura (exceto em pré-visualização).
-- Devolve null se o link não existir, se o convite foi cancelado ou se o evento ainda é rascunho.
create function public.guest_invitation(p_token text, p_track boolean default true) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  if p_token is null or length(p_token) <> 22 then
    return null;
  end if;
  select i.* into v
  from public.invitations i join public.events e on e.id = i.event_id
  where i.token = p_token and i.status <> 'cancelled' and e.status in ('open', 'closed');
  if not found then
    return null;
  end if;
  if p_track then
    update public.invitations
       set first_opened_at = coalesce(first_opened_at, now()),
           last_opened_at = now(),
           open_count = open_count + 1,
           status = case when status in ('draft', 'sent') then 'opened'::public.invitation_status else status end
     where id = v.id;
  end if;
  return public.guest_payload(v.id);
end $$;

-- Resposta do convidado (aceitar ou recusar). Pode ser alterada até ao prazo.
create function public.guest_respond(
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
  select * into v from public.invitations where token = p_token and status <> 'cancelled';
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

  if p_accept and e.capacity is not null then
    select coalesce(sum(1 + (select count(*) from public.companions m where m.invitation_id = i.id)), 0)
      into v_taken
    from public.invitations i
    where i.event_id = e.id and i.status = 'accepted' and i.id <> v.id;
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
         last_opened_at = coalesce(last_opened_at, now())
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

-- Pedido de eliminação de dados feito pelo próprio convidado (fica registado para a equipa tratar).
create function public.guest_request_erasure(p_token text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  select * into v from public.invitations where token = p_token and length(p_token) = 22;
  if not found then
    return false;
  end if;
  perform public.log_activity('privacy.erasure_requested', v.contact_id, v.id, v.event_id, 'link', '{}');
  return true;
end $$;

-- ───────────────────────────── Funções da equipa ─────────────────────────────

-- Marca convites como enviados (sem recuar quem já abriu ou respondeu).
create function public.mark_sent(p_invitation_ids uuid[], p_channel public.channel) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  n integer;
begin
  if not public.can_edit() then
    raise exception 'forbidden';
  end if;
  -- Reenvios (o convite já não era rascunho) ficam na linha do tempo; os primeiros envios
  -- são registados pelo trigger quando o estado passa a "sent".
  insert into public.activities (kind, contact_id, invitation_id, event_id, channel, actor_id)
  select 'invitation.resent', i.contact_id, i.id, i.event_id, p_channel, auth.uid()
  from public.invitations i
  where i.id = any (p_invitation_ids) and i.status not in ('draft', 'cancelled');
  update public.invitations
     set sent_at = now(), sent_channel = p_channel,
         status = case when status = 'draft' then 'sent'::public.invitation_status else status end
   where id = any (p_invitation_ids) and status <> 'cancelled';
  get diagnostics n = row_count;
  return n;
end $$;

-- Números do painel de um evento.
create function public.event_stats(p_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
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
    'expected_attendees', coalesce(sum(1 + comp) filter (where status = 'accepted'), 0),
    'checked_in', coalesce(count(*) filter (where checked_in_at is not null), 0) + coalesce(sum(comp_in), 0),
    'capacity', (select capacity from public.events where id = p_event_id),
    'by_wave', coalesce((select jsonb_agg(w order by w ->> 'wave') from (
        select jsonb_build_object('wave', coalesce(wave, ''), 'invited', count(*),
          'accepted', count(*) filter (where status = 'accepted'),
          'declined', count(*) filter (where status = 'declined')) as w
        from inv group by wave) x), '[]'),
    'by_segment', coalesce((select jsonb_agg(s order by s ->> 'segment') from (
        select jsonb_build_object('segment', coalesce(segment, ''), 'invited', count(*),
          'accepted', count(*) filter (where status = 'accepted'),
          'declined', count(*) filter (where status = 'declined')) as s
        from inv group by segment) y), '[]'))
  into result
  from inv;
  return result;
end $$;

-- Importação em lote: junta por email (ou telefone) e só preenche campos vazios.
-- p_rows: [{"first_name":…, "last_name":…, "email":…, "phone":"+351…", "organization":…, "job_title":…,
--           "segment":…, "tags":[…], "salutation":…, "language":"pt|en", "notes":…}]
create function public.import_contacts(
  p_rows jsonb, p_event_id uuid default null, p_wave text default null, p_plus_ones integer default null
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  r jsonb;
  idx integer := 0;
  v_id uuid;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_invited integer := 0;
  v_errors jsonb := '[]';
  v_plus integer;
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
        insert into public.invitations (event_id, contact_id, wave, plus_ones_allowed)
        values (p_event_id, v_id, nullif(btrim(p_wave), ''), v_plus)
        on conflict (event_id, contact_id) do nothing;
        if found then
          v_invited := v_invited + 1;
        end if;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', idx, 'message', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'updated', v_updated, 'invited', v_invited,
                            'errors', v_errors);
end $$;

-- Direito de acesso (RGPD): tudo o que existe sobre uma pessoa.
create function public.contact_export(p_contact_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_edit() then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'contact', (select to_jsonb(c) from public.contacts c where c.id = p_contact_id),
    'invitations', coalesce((select jsonb_agg(to_jsonb(i) - 'token' - 'checkin_code' || jsonb_build_object(
        'event', e.name, 'companions', (select coalesce(jsonb_agg(m.full_name), '[]')
                                        from public.companions m where m.invitation_id = i.id)))
      from public.invitations i join public.events e on e.id = i.event_id
      where i.contact_id = p_contact_id), '[]'),
    'activities', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at)
      from public.activities a where a.contact_id = p_contact_id), '[]'));
end $$;

-- Direito ao apagamento (RGPD): apaga os dados pessoais e mantém os números agregados.
create function public.anonymize_contact(p_contact_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  update public.contacts set
    salutation = null, first_name = 'Anónimo', last_name = null, email = null, phone = null,
    organization = null, job_title = null, tags = '{}', notes = null, marketing_consent = false,
    anonymized_at = now()
  where id = p_contact_id;
  if not found then
    raise exception 'not_found';
  end if;
  delete from public.companions m using public.invitations i
   where m.invitation_id = i.id and i.contact_id = p_contact_id;
  update public.invitations set answers = '{}', guest_note = null where contact_id = p_contact_id;
  delete from public.activities where contact_id = p_contact_id and kind = 'note';
  update public.activities set detail = '{}' where contact_id = p_contact_id;
  perform public.log_activity('contact.anonymized', p_contact_id, null, null, null, '{}');
end $$;

-- ───────────────────────────── Check-in ─────────────────────────────

-- Registo mínimo para a porta: sem email, telefone, notas ou respostas.
create function public.checkin_record(p_invitation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'invitation_id', i.id, 'event_id', i.event_id, 'event_name', e.name,
    'salutation', c.salutation, 'first_name', c.first_name, 'last_name', c.last_name,
    'organization', c.organization, 'status', i.status, 'wave', i.wave,
    'plus_ones_allowed', i.plus_ones_allowed, 'checked_in_at', i.checked_in_at,
    'companions', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'full_name', m.full_name,
                                                                 'checked_in_at', m.checked_in_at) order by m.created_at)
                            from public.companions m where m.invitation_id = i.id), '[]'))
  from public.invitations i
  join public.contacts c on c.id = i.contact_id
  join public.events e on e.id = i.event_id
  where i.id = p_invitation_id
$$;

-- Procura pelo código lido no QR (aceita o código de check-in ou o link pessoal completo).
create function public.checkin_lookup(p_event_id uuid, p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_token text := substring(coalesce(p_code, '') from '([A-Za-z0-9_-]{22})/?$');
  v_id uuid;
begin
  if not public.can_check_in() then
    raise exception 'forbidden';
  end if;
  select id into v_id from public.invitations
   where event_id = p_event_id and (checkin_code = v_code or (v_token is not null and token = v_token));
  if v_id is null then
    return null;
  end if;
  return public.checkin_record(v_id);
end $$;

create function public.checkin_search(p_event_id uuid, p_query text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := '%' || lower(btrim(coalesce(p_query, ''))) || '%';
begin
  if not public.can_check_in() then
    raise exception 'forbidden';
  end if;
  if length(btrim(coalesce(p_query, ''))) < 2 then
    return '[]';
  end if;
  return coalesce((
    select jsonb_agg(public.checkin_record(x.id) order by x.ord, x.name)
    from (
      select i.id,
             case i.status when 'accepted' then 0 when 'cancelled' then 2 else 1 end as ord,
             lower(coalesce(c.last_name, '') || ' ' || c.first_name) as name
      from public.invitations i join public.contacts c on c.id = i.contact_id
      where i.event_id = p_event_id
        and (lower(c.first_name || ' ' || coalesce(c.last_name, '')) like q
             or lower(coalesce(c.organization, '')) like q
             or exists (select 1 from public.companions m where m.invitation_id = i.id and lower(m.full_name) like q))
      order by ord, name
      limit 25
    ) x), '[]');
end $$;

-- Dá entrada ao convidado (e aos acompanhantes indicados).
-- Sem p_force, só entra quem confirmou presença.
create function public.check_in(p_invitation_id uuid, p_companion_ids uuid[] default '{}', p_force boolean default false)
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
  if v.checked_in_at is null then
    update public.invitations set checked_in_at = now(), checked_in_by = auth.uid() where id = v.id;
    perform public.log_activity('checkin', v.contact_id, v.id, v.event_id, null,
                                jsonb_build_object('status', v.status, 'forced', v.status <> 'accepted'));
  end if;
  update public.companions set checked_in_at = now()
   where invitation_id = v.id and id = any (coalesce(p_companion_ids, '{}')) and checked_in_at is null;
  return public.checkin_record(v.id);
end $$;

create function public.undo_check_in(p_invitation_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v public.invitations;
begin
  if not public.can_edit() then
    raise exception 'forbidden';
  end if;
  update public.invitations set checked_in_at = null, checked_in_by = null
   where id = p_invitation_id returning * into v;
  if not found then
    raise exception 'not_found';
  end if;
  update public.companions set checked_in_at = null where invitation_id = v.id;
  perform public.log_activity('checkin.undone', v.contact_id, v.id, v.event_id, null, '{}');
  return public.checkin_record(v.id);
end $$;

-- ───────────────────────────── Permissões das funções ─────────────────────────────
-- No Supabase as funções novas ficam executáveis por anon. Fecha-se tudo e abre-se o necessário.

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.guest_invitation(text, boolean) to anon, authenticated;
grant execute on function public.guest_respond(text, boolean, jsonb, jsonb, text, boolean) to anon, authenticated;
grant execute on function public.guest_request_erasure(text) to anon, authenticated;

grant execute on function public.is_staff() to authenticated;
grant execute on function public.can_read_crm() to authenticated;
grant execute on function public.can_edit() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_check_in() to authenticated;
grant execute on function public.staff_role_of_current_user() to authenticated;
grant execute on function public.mark_sent(uuid[], public.channel) to authenticated;
grant execute on function public.event_stats(uuid) to authenticated;
grant execute on function public.import_contacts(jsonb, uuid, text, integer) to authenticated;
grant execute on function public.contact_export(uuid) to authenticated;
grant execute on function public.anonymize_contact(uuid) to authenticated;
grant execute on function public.checkin_lookup(uuid, text) to authenticated;
grant execute on function public.checkin_search(uuid, text) to authenticated;
grant execute on function public.check_in(uuid, uuid[], boolean) to authenticated;
grant execute on function public.undo_check_in(uuid) to authenticated;
-- Usadas pelos valores por omissão das colunas (inserts feitos pela equipa).
grant execute on function public.new_token() to authenticated;
grant execute on function public.new_checkin_code() to authenticated;
