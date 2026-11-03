-- Testes do esquema: convidado anónimo, papéis da equipa, importação, check-in e RGPD.
\set admin    'a0000000-0000-4000-8000-000000000001'
\set editor   'a0000000-0000-4000-8000-000000000002'
\set porta    'a0000000-0000-4000-8000-000000000003'
\set viewer   'a0000000-0000-4000-8000-000000000004'
\set estranho 'a0000000-0000-4000-8000-000000000005'

-- ───────── Preparação (superutilizador) ─────────
insert into auth.users (id, email) values
  (:'admin', 'admin@exemplo.pt'), (:'editor', 'editor@exemplo.pt'), (:'porta', 'porta@exemplo.pt'),
  (:'viewer', 'viewer@exemplo.pt'), (:'estranho', 'estranho@exemplo.pt');
insert into staff (user_id, full_name, email, role) values
  (:'admin', 'Admin', 'admin@exemplo.pt', 'admin'),
  (:'editor', 'Editor', 'editor@exemplo.pt', 'editor'),
  (:'porta', 'Porta', 'porta@exemplo.pt', 'checkin'),
  (:'viewer', 'Leitura', 'viewer@exemplo.pt', 'viewer');

-- Tokens e códigos.
select tests.ok(public.new_token() ~ '^[A-Za-z0-9_-]{22}$', 'token com 22 caracteres base64url');
select tests.ok(public.new_checkin_code() ~ '^[2-9A-HJKMNP-Z]{10}$', 'código de check-in com 10 caracteres sem ambiguidades');
select tests.ok((select count(distinct public.new_checkin_code()) from generate_series(1, 2000)) = 2000, 'códigos sem repetições');

-- ───────── Editor cria evento, contactos e convites ─────────
set role authenticated;
select set_config('request.jwt.claim.sub', :'editor', false);

insert into events (slug, name, starts_at, status, capacity, default_plus_ones, marketing_consent_text)
values ('gala-2027', 'Gala Anual', now() + interval '30 days', 'open', 4, 1, 'Aceito receber comunicações futuras.')
returning id as ev \gset
-- Estes testes cobrem o fluxo sem aprovação da equipa (approval.test.sql cobre a aprovação).
update events set requires_approval = false where id = :'ev';
insert into events (slug, name, starts_at, status) values ('rascunho', 'Rascunho', now() + interval '60 days', 'draft')
returning id as ev_draft \gset

insert into contacts (first_name, last_name, email, phone, organization, segment, tags, notes)
values ('  Ana ', 'Silva', ' Ana.Silva@Exemplo.PT ', '+351 912 345 678', 'Exemplo SA', 'Clientes', array['vip', ' vip', 'imprensa'], 'Nota interna')
returning id as ana \gset
select tests.eq((select email from contacts where id = :'ana'), 'ana.silva@exemplo.pt', 'email normalizado');
select tests.eq((select phone from contacts where id = :'ana'), '+351912345678', 'telefone normalizado');
select tests.eq((select first_name from contacts where id = :'ana'), 'Ana', 'nome sem espaços');
select tests.eq((select tags from contacts where id = :'ana'), array['imprensa', 'vip'], 'tags sem repetidos e ordenadas');
select tests.throws($$insert into contacts (first_name, email) values ('X', 'sem-arroba')$$, 'contacts_email_check');
select tests.throws($$insert into contacts (first_name, phone) values ('X', '912345678')$$, 'contacts_phone_check');

insert into contacts (first_name, last_name, organization) values ('Bruno', 'Costa', 'Outra Lda') returning id as bruno \gset
insert into contacts (first_name, last_name) values ('Carla', 'Dias') returning id as carla \gset
insert into contacts (first_name, last_name) values ('Duarte', 'Eça') returning id as duarte \gset

insert into invitations (event_id, contact_id, plus_ones_allowed, wave) values (:'ev', :'ana', 1, 'VIP')
returning id as inv_ana \gset
insert into invitations (event_id, contact_id, wave) values (:'ev', :'bruno', 'Geral') returning id as inv_bruno \gset
insert into invitations (event_id, contact_id) values (:'ev', :'carla') returning id as inv_carla \gset
insert into invitations (event_id, contact_id) values (:'ev', :'duarte') returning id as inv_duarte \gset
insert into invitations (event_id, contact_id) values (:'ev_draft', :'ana') returning id as inv_draft \gset
-- Link e código: não se leem da tabela; o editor recebe-os na vista.
select tests.throws(format('select token from invitations where id = %L', :'inv_ana'), 'permission denied');
select tests.throws(format('select checkin_code from invitations where id = %L', :'inv_ana'), 'permission denied');
select tests.throws(format('select * from invitations where id = %L', :'inv_ana'), 'permission denied');
select token as tok_ana, checkin_code as code_ana from invitation_overview where id = :'inv_ana' \gset
select token as tok_bruno from invitation_overview where id = :'inv_bruno' \gset
select token as tok_carla from invitation_overview where id = :'inv_carla' \gset
select token as tok_duarte from invitation_overview where id = :'inv_duarte' \gset
select token as tok_draft from invitation_overview where id = :'inv_draft' \gset
select tests.ok(:'tok_ana' ~ '^[A-Za-z0-9_-]{22}$', 'editor recebe o link na vista');
select tests.ok(:'code_ana' ~ '^[2-9A-HJKMNP-Z]{10}$', 'editor recebe o código na vista');
select tests.eq((select count(*) from invitations i where i.event_id = :'ev' and i.status = 'draft'), 4::bigint, 'colunas permitidas legíveis');
insert into invitations (event_id, contact_id) values (:'ev', :'ana') on conflict (event_id, contact_id) do nothing returning id;
-- Como o PostgREST: update/delete com returning das colunas pedidas.
update invitations set wave = 'VIP' where id = :'inv_ana' returning id, wave;
insert into invitations (event_id, contact_id) values (:'ev_draft', :'bruno') returning id as inv_tmp \gset
delete from invitations where id = :'inv_tmp' returning id;
select tests.throws(format('update invitations set wave = %L where id = %L returning token', 'X', :'inv_ana'), 'permission denied');
select tests.eq((select invited_by from invitations where id = :'inv_ana'), :'editor'::uuid, 'invited_by preenchido');
select tests.throws(format($$insert into invitations (event_id, contact_id) values (%L, %L)$$, :'ev', :'ana'), 'duplicate key');

-- Envio: rascunho passa a enviado.
select tests.eq(public.mark_sent(array[:'inv_ana', :'inv_bruno', :'inv_carla']::uuid[], 'email'), 3, 'mark_sent devolve 3');
select tests.eq((select status from invitations where id = :'inv_ana'), 'sent'::invitation_status, 'estado enviado');
select tests.eq((select sent_channel from invitations where id = :'inv_ana'), 'email'::channel, 'canal registado');

-- ───────── Convidado anónimo ─────────
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);

select tests.throws('select * from contacts', 'permission denied');
select tests.throws('select * from invitations', 'permission denied');
select tests.throws('select * from events', 'permission denied');
select tests.throws('select * from staff', 'permission denied');
select tests.throws('select * from invitation_overview', 'permission denied');
select tests.throws(format('select public.event_stats(%L)', :'ev'), 'permission denied');
select tests.throws(format('select public.check_in(%L)', :'inv_ana'), 'permission denied');
select tests.throws($$select public.import_contacts('[]')$$, 'permission denied');
select tests.throws(format('select public.guest_payload(%L)', :'inv_ana'), 'permission denied');

select tests.ok(public.guest_invitation('naoexiste_naoexiste_00') is null, 'token inexistente devolve null');
select tests.ok(public.guest_invitation('curto') is null, 'token mal formado devolve null');
select tests.ok(public.guest_invitation(:'tok_draft') is null, 'evento em rascunho não abre');

select public.guest_invitation(:'tok_ana') as g \gset
select tests.eq((:'g'::jsonb #>> '{contact,first_name}'), 'Ana', 'convidado vê o nome');
select tests.ok(not (:'g'::jsonb -> 'contact' ? 'email'), 'convidado não vê o email');
select tests.ok(not (:'g'::jsonb -> 'contact' ? 'notes'), 'convidado não vê notas internas');
select tests.ok((:'g'::jsonb #>> '{invitation,checkin_code}') is null, 'código só depois de confirmar');
select tests.eq((:'g'::jsonb #>> '{event,rsvp_open}'), 'true', 'resposta aberta');

-- Pré-visualização não conta como abertura.
select public.guest_invitation(:'tok_bruno', false) is not null as preview_ok \gset
select tests.ok(:'preview_ok', 'pré-visualização devolve dados');

select tests.throws(format($$select public.guest_respond(%L, true, '{}', '[{"full_name":"A"},{"full_name":"B"}]')$$, :'tok_ana'), 'too_many_companions');
select tests.throws(format($$select public.guest_respond(%L, true, '{}', '[{"full_name":""}]')$$, :'tok_ana'), 'invalid_companions');
select tests.throws(format($$select public.guest_respond(%L, true, '[]')$$, :'tok_ana'), 'invalid_answers');

select public.guest_respond(:'tok_ana', true, '{"dieta":"vegetariana"}', '[{"full_name":"Rui Silva"}]', 'Até breve', true) as r \gset
select tests.eq((:'r'::jsonb #>> '{invitation,status}'), 'accepted', 'aceite');
select tests.eq((:'r'::jsonb #>> '{invitation,checkin_code}'), :'code_ana', 'código visível depois de aceitar');
select tests.eq(jsonb_array_length(:'r'::jsonb #> '{invitation,companions}'), 1, 'acompanhante gravado');
select tests.eq((:'r'::jsonb #>> '{contact,marketing_consent}'), 'true', 'consentimento dado');

-- Lotação 4: Ana + 1 = 2. Bruno (0 acompanhantes) = 3. Carla = 4. Duarte já não cabe.
select public.guest_respond(:'tok_bruno', true) is not null as b_ok \gset
select public.guest_respond(:'tok_carla', true) is not null as c_ok \gset
select tests.throws(format('select public.guest_respond(%L, true)', :'tok_duarte'), 'capacity_full');
-- Mudar de ideias liberta o lugar.
select public.guest_respond(:'tok_carla', false) is not null as c_no \gset
select public.guest_respond(:'tok_duarte', true) is not null as d_ok \gset

select public.guest_request_erasure(:'tok_bruno') as erasure \gset
select tests.ok(:'erasure', 'pedido de apagamento registado');

-- ───────── Fora da equipa ─────────
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'estranho', false);
select tests.eq((select count(*) from contacts), 0::bigint, 'estranho não vê contactos');
select tests.eq((select count(*) from events), 0::bigint, 'estranho não vê eventos');
select tests.throws($$insert into contacts (first_name) values ('Intruso')$$, 'row-level security');
select tests.throws(format('select public.event_stats(%L)', :'ev'), 'forbidden');
select tests.throws(format('select public.checkin_lookup(%L, %L)', :'ev', :'code_ana'), 'forbidden');

-- ───────── Leitura ─────────
select set_config('request.jwt.claim.sub', :'viewer', false);
select tests.eq((select count(*) from contacts), 4::bigint, 'leitura vê contactos');
select tests.ok((select count(*) from invitation_overview where event_id = :'ev') = 4, 'leitura vê a lista do evento');
select tests.eq((select count(*) from invitation_overview where event_id = :'ev' and (token is not null or checkin_code is not null)),
                0::bigint, 'leitura não recebe links nem códigos');
select tests.throws(format('select token from invitations where id = %L', :'inv_ana'), 'permission denied');
select tests.ok((select token from public.invitation_secret(:'inv_ana')) is null, 'invitation_secret não serve à leitura');
select tests.eq((select count(*) from invitations where event_id = :'ev'), 4::bigint, 'leitura lê os convites sem o link');
select tests.throws($$insert into contacts (first_name) values ('X')$$, 'row-level security');
update contacts set notes = 'alterado' where id = :'ana';
select tests.eq((select notes from contacts where id = :'ana'), 'Nota interna', 'leitura não altera');
select tests.throws(format('select public.mark_sent(array[%L]::uuid[], %L)', :'inv_ana', 'email'), 'forbidden');

-- ───────── Porta (check-in) ─────────
select set_config('request.jwt.claim.sub', :'porta', false);
select tests.eq((select count(*) from contacts), 0::bigint, 'porta não vê o CRM');
select tests.eq((select count(*) from invitations), 0::bigint, 'porta não vê convites');
select tests.eq((select count(*) from events), 2::bigint, 'porta vê eventos');
select tests.eq((select count(*) from invitation_overview), 0::bigint, 'porta não vê a lista');
select public.event_stats(:'ev') as st_porta \gset
select tests.eq((:'st_porta'::jsonb -> 'by_segment'), '[]'::jsonb, 'porta não recebe segmentos do CRM');
select tests.eq((:'st_porta'::jsonb -> 'by_wave'), '[]'::jsonb, 'porta não recebe vagas');
select tests.eq((:'st_porta'::jsonb ->> 'invited')::int, 4, 'porta recebe os totais');

select public.checkin_lookup(:'ev', lower(:'code_ana')) as l \gset
select tests.eq((:'l'::jsonb ->> 'first_name'), 'Ana', 'procura por código (minúsculas)');
select tests.ok(not (:'l'::jsonb ? 'email'), 'registo da porta sem email');
select public.checkin_lookup(:'ev', 'https://convites.exemplo.pt/c/' || :'tok_ana') as l2 \gset
select tests.eq((:'l2'::jsonb ->> 'invitation_id'), :'inv_ana', 'procura pelo link pessoal');
select tests.ok(public.checkin_lookup(:'ev_draft', :'code_ana') is null, 'código de outro evento não serve');

select tests.eq(jsonb_array_length(public.checkin_search(:'ev', 'silva')), 1, 'pesquisa por nome');
select tests.eq(jsonb_array_length(public.checkin_search(:'ev', 'rui')), 1, 'pesquisa pelo acompanhante');
select tests.eq(jsonb_array_length(public.checkin_search(:'ev', 'a')), 0, 'pesquisa curta não devolve nada');

select (select (m ->> 'id') from jsonb_array_elements(:'l'::jsonb -> 'companions') m limit 1) as comp_rui \gset
select public.check_in(:'inv_ana', array[:'comp_rui']::uuid[]) as ci \gset
select tests.ok((:'ci'::jsonb ->> 'checked_in_at') is not null, 'entrada registada');
select tests.ok((:'ci'::jsonb #>> '{companions,0,checked_in_at}') is not null, 'acompanhante entrou');
select tests.throws(format('select public.check_in(%L)', :'inv_carla'), 'not_accepted');
select public.check_in(:'inv_carla', '{}', true) is not null as forced \gset
select tests.throws(format('select public.undo_check_in(%L)', :'inv_ana'), 'forbidden');
select public.event_stats(:'ev') as st \gset
select tests.eq((:'st'::jsonb ->> 'checked_in')::int, 3, 'stats: entradas (Ana, Rui, Carla)');

-- Depois da entrada, o convidado já não altera a resposta.
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select tests.throws(format('select public.guest_respond(%L, false)', :'tok_ana'), 'already_checked_in');

-- ───────── Editor: estatísticas, importação, reenvio ─────────
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'editor', false);

select public.event_stats(:'ev') as st \gset
select tests.eq((:'st'::jsonb ->> 'invited')::int, 4, 'stats: convidados');
select tests.eq((:'st'::jsonb #>> '{by_status,accepted}')::int, 3, 'stats: aceites (Ana, Bruno, Duarte)');
select tests.eq((:'st'::jsonb #>> '{by_status,declined}')::int, 1, 'stats: recusados (Carla)');
select tests.eq((:'st'::jsonb ->> 'expected_attendees')::int, 4, 'stats: pessoas esperadas');
select tests.eq((:'st'::jsonb ->> 'responded')::int, 4, 'stats: responderam');
select tests.eq((:'st'::jsonb ->> 'capacity')::int, 4, 'stats: lotação');
select tests.eq(jsonb_array_length(:'st'::jsonb -> 'by_wave'), 3, 'stats: vagas para quem lê o CRM');
select tests.eq(jsonb_array_length(:'st'::jsonb -> 'by_segment'), 2, 'stats: segmentos para quem lê o CRM');

-- Eventos: o editor cria e altera, mas só o administrador elimina (apaga tudo em cascata).
insert into events (slug, name, starts_at) values ('para-apagar', 'Para apagar', now() + interval '90 days')
returning id as ev_del \gset
update events set name = 'Para apagar (editado)' where id = :'ev_del';
select tests.eq((select name from events where id = :'ev_del'), 'Para apagar (editado)', 'editor altera eventos');
delete from events where id = :'ev_del';
select tests.eq((select count(*) from events where id = :'ev_del'), 1::bigint, 'editor não elimina eventos');

select public.mark_sent(array[:'inv_ana']::uuid[], 'whatsapp') as resent \gset
select tests.eq((select status from invitations where id = :'inv_ana'), 'accepted'::invitation_status, 'reenvio não recua o estado');
select tests.eq((select count(*) from activities where invitation_id = :'inv_ana' and kind = 'invitation.resent'), 1::bigint, 'reenvio na linha do tempo');

select public.import_contacts($$[
  {"first_name":"Ana","last_name":"Silva","email":"ANA.SILVA@exemplo.pt","job_title":"Diretora","organization":"Ignorada SA","tags":["parceiros"]},
  {"first_name":"Eva","last_name":"Faria","email":"eva@exemplo.pt","phone":"+351913000000","language":"en"},
  {"first_name":"","email":"sem-nome@exemplo.pt"},
  {"first_name":"Filipe","phone":"+351 913 000 000"}
]$$, :'ev', 'Importados', 0) as imp \gset
select tests.eq((:'imp'::jsonb ->> 'inserted')::int, 1, 'importação: 1 novo (Eva)');
select tests.eq((:'imp'::jsonb ->> 'updated')::int, 2, 'importação: Ana por email e Filipe por telefone');
select tests.eq((:'imp'::jsonb ->> 'invited')::int, 1, 'importação: só a Eva é convite novo');
select tests.eq(jsonb_array_length(:'imp'::jsonb -> 'errors'), 1, 'importação: linha sem nome dá erro');
select tests.eq((:'imp'::jsonb #>> '{errors,0,row}')::int, 3, 'importação: erro na linha 3');
select tests.eq((select job_title from contacts where id = :'ana'), 'Diretora', 'preenche campo vazio');
select tests.eq((select organization from contacts where id = :'ana'), 'Exemplo SA', 'não sobrescreve campo preenchido');
select tests.eq((select tags from contacts where id = :'ana'), array['imprensa', 'parceiros', 'vip'], 'junta tags');
select tests.throws(format('select public.anonymize_contact(%L)', :'ana'), 'forbidden');
update staff set role = 'admin' where user_id = :'editor';  -- a RLS filtra: 0 linhas alteradas
select tests.eq((select role from staff where user_id = :'editor'), 'editor'::staff_role, 'editor não se promove');

-- Linha do tempo.
select tests.ok(exists (select 1 from activities where invitation_id = :'inv_ana' and kind = 'invitation.opened'), 'abertura registada');
select tests.ok(exists (select 1 from activities where invitation_id = :'inv_ana' and kind = 'invitation.accepted'), 'aceitação registada');
select tests.ok(exists (select 1 from activities where invitation_id = :'inv_ana' and kind = 'checkin'), 'entrada registada');
select tests.ok(exists (select 1 from activities where contact_id = :'ana' and kind = 'consent.granted'), 'consentimento registado');
select tests.ok(exists (select 1 from activities where contact_id = :'bruno' and kind = 'privacy.erasure_requested'), 'pedido RGPD registado');
insert into activities (kind, contact_id, detail, actor_id) values ('note', :'ana', '{"text":"Ligou a confirmar"}', :'editor');
select tests.throws(format($$insert into activities (kind, contact_id, actor_id) values ('checkin', %L, %L)$$, :'ana', :'editor'), 'row-level security');
select tests.throws(format($$insert into activities (kind, contact_id, actor_id) values ('note', %L, %L)$$, :'ana', :'admin'), 'row-level security');

-- ───────── Admin: RGPD e equipa ─────────
select set_config('request.jwt.claim.sub', :'admin', false);
select public.contact_export(:'ana') as ex \gset
select tests.ok(jsonb_array_length(:'ex'::jsonb -> 'invitations') = 2, 'exportação inclui os convites');
select tests.ok(not ((:'ex'::jsonb -> 'invitations' -> 0) ? 'token'), 'exportação sem token');

delete from events where id = :'ev_del';
select tests.eq((select count(*) from events where id = :'ev_del'), 0::bigint, 'administrador elimina eventos');

-- Apagamento (RGPD): o link e o código antigos deixam de funcionar.
insert into deliveries (invitation_id, channel, status, error)
values (:'inv_ana', 'email', 'failed', 'Invalid recipient ana.silva@exemplo.pt');
select public.anonymize_contact(:'ana');
select tests.eq((select first_name || coalesce(email, '') || coalesce(phone, '') from contacts where id = :'ana'), 'Anónimo', 'dados pessoais apagados');
select tests.eq((select count(*) from companions where invitation_id = :'inv_ana'), 0::bigint, 'acompanhantes apagados');
select tests.eq((select count(*) from activities where contact_id = :'ana' and kind = 'note'), 0::bigint, 'notas apagadas');
select tests.eq((select status from invitations where id = :'inv_ana'), 'accepted'::invitation_status, 'números do evento mantêm-se');
select tests.eq((select count(*) from deliveries where invitation_id = :'inv_ana' and error is not null), 0::bigint, 'erros de envio apagados');
select tests.ok((select token from invitation_overview where id = :'inv_ana') is distinct from :'tok_ana', 'link novo');
select tests.ok((select checkin_code from invitation_overview where id = :'inv_ana') is distinct from :'code_ana', 'código novo');
select tests.ok(public.checkin_lookup(:'ev', :'code_ana') is null, 'código antigo não dá entrada');
select tests.ok(public.checkin_lookup(:'ev', 'https://convites.exemplo.pt/c/' || :'tok_ana') is null, 'link antigo não dá entrada');
select token as tok_ana_new from invitation_overview where id = :'inv_ana' \gset

reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select tests.ok(public.guest_invitation(:'tok_ana') is null, 'link antigo deixa de abrir');
select tests.ok(public.guest_invitation(:'tok_ana_new') is null, 'convite de contacto apagado não abre');
select tests.throws(format($$select public.guest_respond(%L, true, '{}', '[{"full_name":"Acompanhante"}]', 'Nota', true)$$, :'tok_ana'), 'not_found');
select tests.throws(format('select public.guest_respond(%L, false)', :'tok_ana_new'), 'not_found');
select tests.ok(not public.guest_request_erasure(:'tok_ana'), 'pedido com link antigo não é aceite');

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'admin', false);
select tests.eq((select marketing_consent from contacts where id = :'ana'), false, 'consentimento continua retirado');
select tests.eq((select count(*) from companions where invitation_id = :'inv_ana'), 0::bigint, 'nenhum acompanhante novo');

select tests.throws(format($$update staff set role = 'viewer' where user_id = %L$$, :'admin'), 'last_admin');
update staff set role = 'admin' where user_id = :'editor';
update staff set role = 'viewer' where user_id = :'admin';
select tests.eq((select role from staff where user_id = :'admin'), 'viewer'::staff_role, 'com outro admin já pode sair');
reset role;
