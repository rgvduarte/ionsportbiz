-- Aprovação pela equipa e tipos de acesso: convite → confirmação → por aprovar → aprovado com tipo de acesso → QR.
\set admin  'b0000000-0000-4000-8000-000000000001'
\set editor 'b0000000-0000-4000-8000-000000000002'
\set porta  'b0000000-0000-4000-8000-000000000003'
\set viewer 'b0000000-0000-4000-8000-000000000004'

insert into auth.users (id, email) values
  (:'admin', 'a2@exemplo.pt'), (:'editor', 'e2@exemplo.pt'), (:'porta', 'p2@exemplo.pt'), (:'viewer', 'v2@exemplo.pt');
insert into staff (user_id, full_name, email, role) values
  (:'admin', 'Admin 2', 'a2@exemplo.pt', 'admin'), (:'editor', 'Editor 2', 'e2@exemplo.pt', 'editor'),
  (:'porta', 'Porta 2', 'p2@exemplo.pt', 'checkin'), (:'viewer', 'Leitura 2', 'v2@exemplo.pt', 'viewer');

set role authenticated;
select set_config('request.jwt.claim.sub', :'editor', false);

insert into events (slug, name, starts_at, status) values ('ion-teste', 'ion Teste', now() + interval '60 days', 'open')
returning id as ev \gset
insert into events (slug, name, starts_at, status) values ('outro', 'Outro', now() + interval '90 days', 'open')
returning id as ev2 \gset
select tests.eq((select requires_approval from events where id = :'ev'), true, 'aprovação obrigatória por omissão');

insert into pass_types (event_id, name, accesses, color, sort)
values (:'ev', 'VIP Pass', array['VIP Gala Dinner', 'Awards Ceremony', 'ion Conference', 'VIP Lunch'], '#ccff00', 0)
returning id as vip \gset
insert into pass_types (event_id, name, accesses, sort) values (:'ev', 'Conference Pass', array['ion Conference'], 1)
returning id as conf \gset
insert into pass_types (event_id, name) values (:'ev2', 'Outro passe') returning id as other_pass \gset
select tests.throws(format($$insert into pass_types (event_id, name) values (%L, 'VIP Pass')$$, :'ev'), 'duplicate key');

insert into contacts (first_name, last_name) values ('Inês', 'Lopes') returning id as ines \gset
insert into contacts (first_name, last_name) values ('Jorge', 'Matos') returning id as jorge \gset
insert into contacts (first_name, last_name) values ('Lara', 'Nunes') returning id as lara \gset
insert into invitations (event_id, contact_id) values (:'ev', :'ines') returning id as inv_ines \gset
insert into invitations (event_id, contact_id) values (:'ev', :'jorge') returning id as inv_jorge \gset
insert into invitations (event_id, contact_id) values (:'ev', :'lara') returning id as inv_lara \gset
-- O link e o código só se leem pela vista (invitation_secret), não da tabela.
select token as tok_ines, checkin_code as code_ines from invitation_overview where id = :'inv_ines' \gset
select token as tok_jorge from invitation_overview where id = :'inv_jorge' \gset
select token as tok_lara from invitation_overview where id = :'inv_lara' \gset
select tests.eq((select approval_status from invitations where id = :'inv_ines'), 'pending'::approval_status, 'convite nasce por aprovar');
select tests.throws(format($$update invitations set pass_type_id = %L where id = %L$$, :'other_pass', :'inv_ines'), 'invalid_pass_type');
select public.mark_sent(array[:'inv_ines', :'inv_jorge', :'inv_lara']::uuid[], 'email');

-- Convidado confirma: fica por aprovar e ainda sem QR.
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public.guest_respond(:'tok_ines', true) as r \gset
select tests.eq((:'r'::jsonb #>> '{invitation,status}'), 'accepted', 'confirmado');
select tests.eq((:'r'::jsonb #>> '{invitation,approval_status}'), 'pending', 'por aprovar');
select tests.ok((:'r'::jsonb #>> '{invitation,checkin_code}') is null, 'sem QR antes da aprovação');
select tests.ok((:'r'::jsonb #> '{invitation,pass_type}') = 'null'::jsonb, 'sem tipo de acesso antes da aprovação');
select tests.eq((:'r'::jsonb #>> '{event,requires_approval}'), 'true', 'convidado sabe que há aprovação');
select tests.throws(format('select public.approve_invitations(array[%L]::uuid[], %L)', :'inv_ines', :'vip'), 'permission denied');
select public.guest_respond(:'tok_jorge', true) is not null as j \gset

-- Equipa: leitura e receção não aprovam; editor aprova.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'viewer', false);
select tests.throws(format('select public.approve_invitations(array[%L]::uuid[], %L)', :'inv_ines', :'vip'), 'forbidden');
select tests.eq((select pass_type_name from invitation_overview where id = :'inv_ines'), null::text, 'leitura vê o estado na lista');
select set_config('request.jwt.claim.sub', :'porta', false);
select tests.throws(format('select public.approve_invitations(array[%L]::uuid[], %L)', :'inv_ines', :'vip'), 'forbidden');
select tests.eq((select count(*) from pass_types), 3::bigint, 'receção vê os tipos de acesso');
-- Por aprovar: a porta não deixa entrar sem forçar.
select tests.throws(format('select public.check_in(%L)', :'inv_ines'), 'not_approved');

select set_config('request.jwt.claim.sub', :'editor', false);
select tests.throws(format('select public.approve_invitations(array[%L]::uuid[], %L)', :'inv_ines', :'other_pass'), 'invalid_pass_type');
select tests.eq(public.approve_invitations(array[:'inv_ines', :'inv_lara']::uuid[], :'vip'), 2, 'aprova dois (Lara ainda não respondeu)');
select tests.eq(public.approve_invitations(array[:'inv_ines']::uuid[], :'vip'), 0, 'aprovar de novo não repete');
select tests.eq(public.reject_invitations(array[:'inv_jorge']::uuid[], 'Lotação VIP esgotada'), 1, 'recusa o Jorge');
select tests.eq((select approval_status from invitations where id = :'inv_jorge'), 'rejected'::approval_status, 'Jorge recusado');
select tests.eq((select pass_type_name from invitation_overview where id = :'inv_ines'), 'VIP Pass', 'lista mostra o tipo de acesso');
select tests.ok(exists (select 1 from activities where invitation_id = :'inv_ines' and kind = 'invitation.approved' and detail ->> 'pass_type' = 'VIP Pass'), 'aprovação na linha do tempo');
select tests.ok(exists (select 1 from activities where invitation_id = :'inv_jorge' and kind = 'invitation.rejected' and detail ->> 'reason' = 'Lotação VIP esgotada'), 'recusa na linha do tempo');

select public.event_stats(:'ev') as st \gset
select tests.eq((:'st'::jsonb #>> '{approval,approved}')::int, 1, 'stats: 1 aprovado com presença confirmada');
select tests.eq((:'st'::jsonb #>> '{approval,rejected}')::int, 1, 'stats: 1 recusado');
select tests.eq((:'st'::jsonb #>> '{approval,pending}')::int, 0, 'stats: 0 por aprovar');
select tests.eq((:'st'::jsonb ->> 'expected_attendees')::int, 1, 'stats: recusados não contam como esperados');
select tests.eq((:'st'::jsonb #>> '{by_pass_type,0,name}'), 'VIP Pass', 'stats: por tipo de acesso');
select tests.eq((:'st'::jsonb #>> '{by_pass_type,0,approved}')::int, 1, 'stats: 1 VIP confirmado');

-- Convidado aprovado recebe o QR e os acessos; pré-aprovada recebe-os ao confirmar.
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public.guest_invitation(:'tok_ines', false) as g \gset
select tests.eq((:'g'::jsonb #>> '{invitation,checkin_code}'), :'code_ines', 'QR depois da aprovação');
select tests.eq((:'g'::jsonb #>> '{invitation,pass_type,name}'), 'VIP Pass', 'tipo de acesso visível');
select tests.eq(jsonb_array_length(:'g'::jsonb #> '{invitation,pass_type,accesses}'), 4, 'acessos visíveis');
select public.guest_invitation(:'tok_jorge', false) as gj \gset
select tests.ok((:'gj'::jsonb #>> '{invitation,checkin_code}') is null, 'recusado sem QR');
select tests.eq((:'gj'::jsonb #>> '{invitation,approval_status}'), 'rejected', 'recusado sabe o estado');
select public.guest_invitation(:'tok_lara', false) as gl \gset
select tests.ok((:'gl'::jsonb #>> '{invitation,checkin_code}') is null, 'pré-aprovada mas sem resposta: sem QR');
select public.guest_respond(:'tok_lara', true) as rl \gset
select tests.ok((:'rl'::jsonb #>> '{invitation,checkin_code}') is not null, 'pré-aprovada recebe QR ao confirmar');
select tests.eq((:'rl'::jsonb #>> '{invitation,approval_status}'), 'approved', 'confirmar não desfaz a aprovação');

-- Porta: aprovado entra; recusado só forçando.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'porta', false);
select public.checkin_lookup(:'ev', :'code_ines') as l \gset
select tests.eq((:'l'::jsonb #>> '{pass_type,name}'), 'VIP Pass', 'porta vê o tipo de acesso');
select tests.eq((:'l'::jsonb ->> 'approval_status'), 'approved', 'porta vê a aprovação');
select tests.ok((public.check_in(:'inv_ines') ->> 'checked_in_at') is not null, 'aprovado entra');
select tests.throws(format('select public.check_in(%L)', :'inv_jorge'), 'not_approved');
select tests.ok((public.check_in(:'inv_jorge', '{}', true) ->> 'checked_in_at') is not null, 'forçar deixa entrar');

-- Editor: repor aprovação não mexe em quem já entrou.
select set_config('request.jwt.claim.sub', :'editor', false);
select tests.eq(public.reset_approval(array[:'inv_ines', :'inv_lara']::uuid[]), 1, 'repõe só quem ainda não entrou');
select tests.eq((select approval_status from invitations where id = :'inv_lara'), 'pending'::approval_status, 'Lara volta a por aprovar');

-- Sem aprovação obrigatória: quem confirma fica aprovado (sem tipo de acesso).
update events set requires_approval = false where id = :'ev2';
insert into contacts (first_name) values ('Rui') returning id as rui \gset
insert into invitations (event_id, contact_id) values (:'ev2', :'rui') returning id as inv_rui \gset
select token as tok_rui from invitation_overview where id = :'inv_rui' \gset
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select public.guest_respond(:'tok_rui', true) as rr \gset
select tests.eq((:'rr'::jsonb #>> '{invitation,approval_status}'), 'approved', 'sem aprovação: aprovado ao confirmar');
select tests.ok((:'rr'::jsonb #>> '{invitation,checkin_code}') is not null, 'sem aprovação: QR ao confirmar');
reset role;
