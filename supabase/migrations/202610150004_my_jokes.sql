begin;

-- Jokes an account has shared, newest first, with every version and its full rating totals for the author's analytics.
create function public.my_jokes(p_user_id text, p_limit int default 200)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(item.joke order by item.created_at desc, item.id desc), '[]'::jsonb)
  from (
    select j.id, j.created_at, jsonb_build_object(
      'id', j.id,
      'body', j.body,
      'source_language', j.source_language,
      'created_at', j.created_at,
      'adaptations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'audience', a.audience,
          'body', a.body,
          'funny', s.funny,
          'not_funny', s.not_funny
        ) order by array_position(array['en', 'es', 'zh'], a.audience))
        from public.joke_adaptations a
        cross join lateral (
          select (count(*) filter (where r.funny))::int as funny,
            (count(*) filter (where not r.funny))::int as not_funny
          from public.adaptation_ratings r
          where r.adaptation_id = a.id
        ) s
        where a.joke_id = j.id
      ), '[]'::jsonb)
    ) as joke
    from public.jokes j
    where j.author_id = p_user_id
    order by j.created_at desc, j.id desc
    limit greatest(p_limit, 0)
  ) item;
$$;
revoke all on function public.my_jokes(text, int) from public, anon, authenticated;
grant execute on function public.my_jokes(text, int) to service_role;

commit;
