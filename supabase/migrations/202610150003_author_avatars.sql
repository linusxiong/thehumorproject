begin;

-- Remember each member's Google photo so their jokes can show the avatar they chose, even to other readers.
alter table public.user_profiles
  add column google_url text check (length(google_url) between 1 and 2048);

-- Same feed as before, plus the author's avatar for member jokes. The author's id never leaves the database.
create or replace function public.joke_feed(p_user_id text default null, p_joke_id bigint default null, p_limit int default 50)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(feed.joke order by feed.created_at desc, feed.id desc), '[]'::jsonb)
  from (
    select j.id, j.created_at, jsonb_build_object(
      'id', j.id,
      'body', j.body,
      'source_language', j.source_language,
      'origin', j.origin,
      'source_label', j.source_label,
      'author_name', j.author_name,
      'author_avatar_path', case when p.avatar_source = 'upload' then p.avatar_path end,
      'author_google_url', p.google_url,
      'created_at', j.created_at,
      'adaptations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'audience', a.audience,
          'body', a.body,
          'gloss', a.gloss,
          'punchline_core', a.punchline_core,
          'notes', a.notes,
          'funny', s.funny,
          'not_funny', s.not_funny,
          'user_rating', s.user_rating
        ) order by array_position(array['en', 'es', 'zh'], a.audience))
        from public.joke_adaptations a
        cross join lateral (
          select (count(*) filter (where r.funny))::int as funny,
            (count(*) filter (where not r.funny))::int as not_funny,
            bool_or(r.funny) filter (where r.user_id = p_user_id) as user_rating
          from public.adaptation_ratings r
          where r.adaptation_id = a.id
        ) s
        where a.joke_id = j.id
      ), '[]'::jsonb)
    ) as joke
    from public.jokes j
    left join public.user_profiles p on p.user_id = j.author_id
    where p_joke_id is null or j.id = p_joke_id
    order by j.created_at desc, j.id desc
    limit greatest(p_limit, 0)
  ) feed;
$$;

-- Ratings an account has given, newest first, with the version and joke they belong to.
create function public.my_ratings(p_user_id text, p_limit int default 200)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(item.rating order by item.updated_at desc, item.adaptation_id desc), '[]'::jsonb)
  from (
    select r.adaptation_id, r.updated_at, jsonb_build_object(
      'adaptation_id', r.adaptation_id,
      'funny', r.funny,
      'rated_at', r.updated_at,
      'audience', a.audience,
      'version', a.body,
      'joke', jsonb_build_object(
        'id', j.id,
        'body', j.body,
        'source_language', j.source_language,
        'origin', j.origin,
        'source_label', j.source_label,
        'author_name', j.author_name
      )
    ) as rating
    from public.adaptation_ratings r
    join public.joke_adaptations a on a.id = r.adaptation_id
    join public.jokes j on j.id = a.joke_id
    where r.user_id = p_user_id
    order by r.updated_at desc, r.adaptation_id desc
    limit greatest(p_limit, 0)
  ) item;
$$;
revoke all on function public.my_ratings(text, int) from public, anon, authenticated;
grant execute on function public.my_ratings(text, int) to service_role;

commit;
