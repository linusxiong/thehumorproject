begin;

-- Avatar preferences use the same verified-email digest as caption votes.
create table public.user_profiles (
  user_id text primary key check (length(user_id) > 0),
  avatar_source text not null default 'google' check (avatar_source in ('google', 'upload')),
  avatar_path text check (length(avatar_path) > 0),
  updated_at timestamptz not null default now(),
  constraint user_profiles_upload_has_path check (avatar_source = 'google' or avatar_path is not null)
);

-- Only the app server's secret key may read or change profiles.
alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.user_profiles to service_role;

-- Swap or clear the uploaded photo atomically and return the path it replaced for cleanup.
create function public.replace_avatar(p_user_id text, p_path text)
returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  previous text;
begin
  insert into public.user_profiles (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select avatar_path into previous from public.user_profiles where user_id = p_user_id for update;
  update public.user_profiles
  set avatar_source = case when p_path is null then 'google' else 'upload' end,
    avatar_path = p_path, updated_at = now()
  where user_id = p_user_id;
  return previous;
end;
$$;
revoke all on function public.replace_avatar(text, text) from public, anon, authenticated;
grant execute on function public.replace_avatar(text, text) to service_role;

-- Photos are readable by URL; random object names keep them unguessable and listing stays denied.
-- Uploads and deletions only happen through the app server.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

commit;
