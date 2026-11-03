-- Simula o mínimo do Supabase (papéis, auth.users, auth.uid() e privilégios por omissão)
-- para testar as migrações num Postgres normal. Não é aplicado no projeto real.
-- Os papéis são do cluster: cada base de dados de teste reaproveita-os.
do $$ begin create role anon nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end $$;

create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Ajudas para os testes.
create schema tests;
grant usage on schema tests to anon, authenticated;

-- Falha se p_sql não der erro (ou se a mensagem não contiver p_like).
create function tests.throws(p_sql text, p_like text default null) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_like is not null and sqlerrm not like '%' || p_like || '%' then
      raise exception 'Erro inesperado em [%]: % (esperava "%")', p_sql, sqlerrm, p_like;
    end if;
    return;
  end;
  raise exception 'Esperava erro em [%]', p_sql;
end $$;

create function tests.eq(p_actual anyelement, p_expected anyelement, p_msg text) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FALHOU %: obtido %, esperado %', p_msg, p_actual, p_expected;
  end if;
end $$;

create function tests.ok(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is not true then
    raise exception 'FALHOU %', p_msg;
  end if;
end $$;

grant execute on all functions in schema tests to anon, authenticated;
