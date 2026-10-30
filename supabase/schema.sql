-- 在 Supabase SQL Editor 執行。本檔可重複執行，不會重設庫存或編輯者。
-- 正式上線前，請依 docs/SETUP.md 建立帳號並授權編輯者。

create table if not exists public.editors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_state (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0 check (revision >= 0),
  payload jsonb not null default '{"drinks":[],"events":[],"wishes":[],"lastInventoryAt":null}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint inventory_payload_is_object check (jsonb_typeof(payload) = 'object')
);

insert into public.inventory_state (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.editors enable row level security;
alter table public.inventory_state enable row level security;

-- 瀏覽器只能讀取自己的編輯資格；只有 SQL Editor 等可信後端可授權帳號。
revoke all on table public.editors from anon, authenticated;
grant select on table public.editors to authenticated;
drop policy if exists editors_read_own on public.editors;
create policy editors_read_own on public.editors
  for select to authenticated
  using (user_id = (select auth.uid()));

-- 網址持有人可以讀取整份庫存、歷史紀錄與許願資料。
-- 庫存與採購狀態的寫入僅限編輯者；任何人可透過專用函式新增待評估願望。
revoke all on table public.inventory_state from anon, authenticated;
grant select on table public.inventory_state to anon, authenticated;
drop policy if exists inventory_public_read on public.inventory_state;
create policy inventory_public_read on public.inventory_state
  for select to anon, authenticated
  using (true);

-- 使用具名複合型別，允許 RPC 輸入與回傳欄位同樣命名為 payload。
do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'inventory_save_result'
  ) then
    create type public.inventory_save_result as (
      revision bigint,
      payload jsonb,
      updated_at timestamptz
    );
  end if;
end
$$;

create or replace function public.save_inventory(
  expected_revision bigint,
  payload jsonb
)
returns setof public.inventory_save_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.inventory_save_result;
begin
  if auth.uid() is null or not exists (
    select 1 from public.editors e where e.user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'editor_required';
  end if;

  if expected_revision is null or expected_revision < 0 then
    raise exception using errcode = '22023', message = 'invalid_revision';
  end if;

  if payload is null
     or jsonb_typeof(payload) is distinct from 'object'
     or jsonb_typeof(payload -> 'drinks') is distinct from 'array'
     or jsonb_typeof(payload -> 'events') is distinct from 'array'
     or jsonb_typeof(payload -> 'wishes') is distinct from 'array'
     or not (payload ? 'lastInventoryAt')
  then
    raise exception using errcode = '22023', message = 'invalid_inventory_payload';
  end if;

  -- 單一 UPDATE 同時比對版本與寫入整份文件，避免兩人盤點互相覆蓋。
  update public.inventory_state as inventory
  set payload = save_inventory.payload,
      revision = inventory.revision + 1,
      updated_at = clock_timestamp()
  where inventory.singleton = true
    and inventory.revision = expected_revision
  returning inventory.revision, inventory.payload, inventory.updated_at
    into saved;

  if not found then
    raise exception using errcode = '40001', message = 'inventory_conflict';
  end if;

  return next saved;
end;
$$;

revoke all on function public.save_inventory(bigint, jsonb) from public, anon;
grant execute on function public.save_inventory(bigint, jsonb) to authenticated;

-- 公開許願只接受名稱、連結、備註。ID、時間與待評估狀態由伺服器決定。
-- 使用單一 UPDATE 在目前最新的 wishes 陣列附加資料，不接受外部傳入整份庫存。
create or replace function public.submit_wish(
  wish_name text,
  wish_url text,
  wish_note text
)
returns setof public.inventory_save_result
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := btrim(coalesce(wish_name, ''));
  clean_url text := btrim(coalesce(wish_url, ''));
  clean_note text := btrim(coalesce(wish_note, ''));
  new_wish jsonb;
  saved public.inventory_save_result;
begin
  if char_length(clean_name) = 0 or char_length(clean_name) > 80
     or char_length(clean_note) > 500 or char_length(clean_url) > 2000
  then
    raise exception using errcode = '22023', message = 'invalid_wish_fields';
  end if;

  -- 限 http(s) 網址；authority 不可包含帳號密碼、空白或反斜線。
  if clean_url <> '' and (
    clean_url !~* '^https?://[^[:space:]/@?#\\]+([/?#][^[:space:]\\]*)?$'
  ) then
    raise exception using errcode = '22023', message = 'invalid_wish_url';
  end if;

  new_wish := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', clean_name,
    'url', clean_url,
    'note', clean_note,
    'status', 'pending',
    'createdAt', clock_timestamp()
  );

  update public.inventory_state as inventory
  set payload = jsonb_set(
        inventory.payload,
        '{wishes}',
        (inventory.payload -> 'wishes') || jsonb_build_array(new_wish),
        false
      ),
      revision = inventory.revision + 1,
      updated_at = clock_timestamp()
  where inventory.singleton = true
  returning inventory.revision, inventory.payload, inventory.updated_at
    into saved;

  if not found then
    raise exception using errcode = 'P0002', message = 'inventory_not_initialized';
  end if;

  return next saved;
end;
$$;

revoke all on function public.submit_wish(text, text, text) from public;
grant execute on function public.submit_wish(text, text, text) to anon, authenticated;

-- 登入後仍須存在 editors 內才可管理庫存與既有願望。把實際帳號 UUID 代入後另行執行：
-- insert into public.editors (user_id)
-- values ('使用者 UUID'::uuid), ('老闆娘 UUID'::uuid)
-- on conflict (user_id) do nothing;
