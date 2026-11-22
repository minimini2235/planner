-- 흑백 플래너: 동기화용 표 만들기
-- Supabase → SQL Editor 에 전체를 붙여넣고 Run. (여러 번 실행해도 안전합니다.)

-- 사람마다 한 줄: 플래너 기록 전체를 JSON 하나로 저장
create table if not exists public.planner_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- 본인 줄만 읽고 쓸 수 있게 (이게 없으면 다른 사람이 볼 수 있음)
alter table public.planner_data enable row level security;

drop policy if exists "own row: read"   on public.planner_data;
drop policy if exists "own row: insert" on public.planner_data;
drop policy if exists "own row: update" on public.planner_data;
drop policy if exists "own row: delete" on public.planner_data;
create policy "own row: read"   on public.planner_data for select to authenticated using (auth.uid() = user_id);
create policy "own row: insert" on public.planner_data for insert to authenticated with check (auth.uid() = user_id);
create policy "own row: update" on public.planner_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row: delete" on public.planner_data for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.planner_data to authenticated;

-- 저장할 때마다 서버 시각을 기록 (기기마다 시계가 달라도 순서가 맞도록)
create or replace function public.planner_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists planner_touch on public.planner_data;
create trigger planner_touch before insert or update on public.planner_data
  for each row execute function public.planner_touch();
