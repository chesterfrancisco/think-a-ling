-- Run once in the dedicated Think-a-ling Supabase project SQL editor.
create table if not exists public.discoveries (
  id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 200000),
  created_at timestamptz not null default now(),
  primary key (owner_id, id),
  constraint payload_shape check (payload ?& array['id','title','kind','content','source','photoName','caveats','evidence','savedAt'] and jsonb_typeof(payload->'evidence') = 'array' and jsonb_typeof(payload->'caveats') = 'array' and length(payload->>'content') between 1 and 60000 and payload->>'kind' in ('text','scene','answer')),
  constraint matching_payload_id check ((payload->>'id') = id::text)
);
alter table public.discoveries enable row level security;
revoke all on public.discoveries from anon;
grant select, insert, delete on public.discoveries to authenticated;
create policy "Read own discoveries" on public.discoveries for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Insert own discoveries" on public.discoveries for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Delete own discoveries" on public.discoveries for delete to authenticated using ((select auth.uid()) = owner_id);
create or replace function public.limit_discoveries() returns trigger language plpgsql set search_path = '' as $$
begin
  -- Serialize concurrent inserts for this owner so quota cannot race.
  perform pg_advisory_xact_lock(hashtextextended(new.owner_id::text, 0));
  if (select count(*) from public.discoveries where owner_id = new.owner_id) >= 100 then
    raise exception 'Account history limit reached';
  end if;
  return new;
end;
$$;
create trigger discovery_quota before insert on public.discoveries for each row execute function public.limit_discoveries();
create or replace function public.delete_own_account() returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
