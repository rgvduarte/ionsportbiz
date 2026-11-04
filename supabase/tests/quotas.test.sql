-- Quotas por tipo de acesso e pré-aprovação ao convidar/importar.
\set editor 'c0000000-0000-4000-8000-000000000001'
\set viewer 'c0000000-0000-4000-8000-000000000002'

insert into auth.users (id, email) values (:'editor', 'e3@exemplo.pt'), (:'viewer', 'v3@exemplo.pt');
insert into staff (user_id, full_name, email, role) values
  (:'editor', 'Editor 3', 'e3@exemplo.pt', 'editor'), (:'viewer', 'Leitura 3', 'v3@exemplo.pt', 'viewer');

set role authenticated;
select set_config('request.jwt.claim.sub', :'editor', false);

insert into events (slug, name, starts_at, status) values ('ion-quotas', 'ion Quotas', now() + interval '60 days', 'open')
returning id as ev \gset
insert into events (slug, name, starts_at, status) values ('outro-q', 'Outro', now() + interval '90 days', 'open')
returning id as ev2 \gset
insert into pass_types (event_id, name, capacity, sort) values (:'ev', 'VIP Pass', 2, 0) returning id as vip \gset
insert into pass_types (event_id, name, sort) values (:'ev', 'Conference Pass', 1) returning id as conf \gset
insert into pass_types (event_id, name) values (:'ev2', 'Outro passe') returning id as other_pass \gset
select tests.throws(format($$update pass_types set capacity = 0 where id = %L$$, :'vip'), 'check constraint');

insert into contacts (first_name) values ('Ana') returning id as ana \gset
insert into contacts (first_name) values ('Bruno') returning id as bruno \gset
insert into contacts (first_name) values ('Carla') returning id as carla \gset
insert into contacts (first_name) values ('Duarte') returning id as duarte \gset
insert into contacts (first_name) values ('Eva') returning id as eva \gset

-- Convidar com pré-aprovação: cria e aprova na mesma transação.
select tests.eq(public.invite_contacts(:'ev', array[:'ana', :'bruno']::uuid[], 'VIP', null, :'vip'), 2, 'convida e pré-aprova 2 VIP');
select tests.eq((select count(*) from invitations where event_id = :'ev' and pass_type_id = :'vip' and approval_status = 'approved'), 2::bigint, 'ficam pré-aprovados com VIP');
select tests.eq((select wave from invitations where contact_id = :'ana' and event_id = :'ev'), 'VIP', 'vaga gravada');
select tests.eq(public.invite_contacts(:'ev', array[:'ana']::uuid[], null, null, :'vip'), 0, 'já convidado: ignora');

-- Quota cheia: nada é criado.
select tests.throws(format('select public.invite_contacts(%L, array[%L]::uuid[], null, null, %L)', :'ev', :'carla', :'vip'), 'pass_quota');
select tests.eq((select count(*) from invitations where contact_id = :'carla'), 0::bigint, 'quota cheia: convite desfeito');
-- Tipo de outro evento: nada é criado.
select tests.throws(format('select public.invite_contacts(%L, array[%L]::uuid[], null, null, %L)', :'ev', :'carla', :'other_pass'), 'invalid_pass_type');
select tests.eq((select count(*) from invitations where contact_id = :'carla'), 0::bigint, 'tipo inválido: convite desfeito');

-- Sem tipo de acesso: convida por aprovar. Sem quota (Conference): aprova à vontade.
select tests.eq(public.invite_contacts(:'ev', array[:'carla', :'duarte']::uuid[]), 2, 'convida sem pré-aprovação');
select id as inv_carla from invitations where contact_id = :'carla' and event_id = :'ev' \gset
select id as inv_duarte from invitations where contact_id = :'duarte' and event_id = :'ev' \gset
select id as inv_ana from invitations where contact_id = :'ana' and event_id = :'ev' \gset
select tests.eq((select approval_status from invitations where id = :'inv_carla'), 'pending'::approval_status, 'fica por aprovar');
select tests.throws(format('select public.approve_invitations(array[%L]::uuid[], %L)', :'inv_carla', :'vip'), 'pass_quota');
select tests.eq((select approval_status from invitations where id = :'inv_carla'), 'pending'::approval_status, 'aprovação recusada não altera');
select tests.eq(public.approve_invitations(array[:'inv_carla', :'inv_duarte']::uuid[], :'conf'), 2, 'Conference sem quota');

-- Mudar de tipo conta para a quota do destino; repetir o mesmo tipo não conta.
select tests.eq(public.approve_invitations(array[:'inv_ana']::uuid[], :'vip'), 0, 'já VIP: sem alteração nem erro');
select tests.eq(public.approve_invitations(array[:'inv_ana']::uuid[], :'conf'), 1, 'Ana passa a Conference: liberta um VIP');
select tests.eq(public.approve_invitations(array[:'inv_carla']::uuid[], :'vip'), 1, 'Carla passa a VIP (2/2)');
select tests.throws(format('select public.approve_invitations(array[%L]::uuid[], %L)', :'inv_duarte', :'vip'), 'pass_quota');

-- Recusas e cancelamentos libertam a quota.
update invitations set status = 'cancelled' where id = :'inv_carla';
select tests.eq(public.approve_invitations(array[:'inv_duarte']::uuid[], :'vip'), 1, 'cancelado liberta: Duarte entra no VIP');
-- Aumentar a quota abre lugares.
update pass_types set capacity = 3 where id = :'vip';
select tests.eq(public.approve_invitations(array[:'inv_ana']::uuid[], :'vip'), 1, 'quota 3: Ana volta a VIP');

-- Importar com pré-aprovação.
update pass_types set capacity = null where id = :'vip';
select public.import_contacts('[{"first_name":"Filipa","email":"filipa@exemplo.pt"},{"first_name":"Gil","email":"gil@exemplo.pt"},{"first_name":""}]'::jsonb,
                              :'ev', 'Importados', null, :'vip') as imp \gset
select tests.eq((:'imp'::jsonb ->> 'invited')::int, 2, 'importação convida 2');
select tests.eq(jsonb_array_length(:'imp'::jsonb -> 'errors'), 1, 'linha sem nome fica nos erros');
select tests.eq((select count(*) from invitation_overview where wave = 'Importados' and approval_status = 'approved' and pass_type_name = 'VIP Pass'), 2::bigint, 'importados pré-aprovados VIP');
update pass_types set capacity = 5 where id = :'vip';
select tests.throws($$select public.import_contacts('[{"first_name":"Hugo","email":"hugo@exemplo.pt"}]'::jsonb, $$ || quote_literal(:'ev') || $$::uuid, null, null, $$ || quote_literal(:'vip') || $$::uuid)$$, 'pass_quota');
select tests.eq((select count(*) from contacts where email = 'hugo@exemplo.pt'), 0::bigint, 'quota cheia: importação desfeita');
select tests.throws(format($$select public.import_contacts('[{"first_name":"Ivo"}]'::jsonb, null, null, null, %L)$$, :'vip'), 'invalid_pass_type');
select tests.throws(format($$select public.import_contacts('[{"first_name":"Ivo"}]'::jsonb, %L, null, null, %L)$$, :'ev', :'other_pass'), 'invalid_pass_type');
-- Sem tipo de acesso: igual a antes.
select public.import_contacts('[{"first_name":"Joana","email":"joana@exemplo.pt"}]'::jsonb, :'ev') as imp2 \gset
select tests.eq((select approval_status from invitation_overview where email = 'joana@exemplo.pt'), 'pending'::approval_status, 'importação simples fica por aprovar');

-- Permissões: leitura não convida; anónimo não chega às funções.
select set_config('request.jwt.claim.sub', :'viewer', false);
select tests.throws(format('select public.invite_contacts(%L, array[%L]::uuid[])', :'ev', :'eva'), 'forbidden');
reset role;
set role anon;
select tests.throws(format('select public.invite_contacts(%L, array[%L]::uuid[])', :'ev', :'eva'), 'permission denied');
select tests.throws($$select public.import_contacts('[]'::jsonb)$$, 'permission denied');
reset role;
