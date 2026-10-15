begin;

-- Admin area. Only accounts with is_superadmin may open it; the flag is never set by the app itself,
-- only out of band with the server-only key (scripts/grant-superadmin.ts) or the SQL editor.
-- The app also remembers each member's name, email, and last visit so the admin area can list accounts.
alter table public.user_profiles
  add column is_superadmin boolean not null default false,
  add column display_name text check (length(display_name) between 1 and 200),
  add column email text check (length(email) between 3 and 320),
  add column created_at timestamptz not null default now(),
  add column last_seen_at timestamptz;
update public.user_profiles set created_at = updated_at;

-- Superadmins can correct an AI-generated version in place; updated_at marks edited versions.
alter table public.joke_adaptations add column updated_at timestamptz;
grant update (body, gloss, punchline_core, notes, updated_at) on public.joke_adaptations to service_role;

-- Every known account: profiles, joke authors, raters, and explainers, with their activity.
create function public.admin_users()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with accounts as (
    select user_id from public.user_profiles
    union select author_id from public.jokes where author_id is not null
    union select user_id from public.adaptation_ratings
    union select user_id from public.joke_explanations
  ),
  joke_stats as (
    select author_id as user_id, count(*)::int as jokes, min(created_at) as first_at, max(created_at) as last_at,
      (array_agg(author_name order by created_at desc))[1] as author_name
    from public.jokes where author_id is not null group by author_id
  ),
  rating_stats as (
    select user_id, count(*)::int as ratings, (count(*) filter (where funny))::int as funny,
      min(created_at) as first_at, max(updated_at) as last_at
    from public.adaptation_ratings group by user_id
  ),
  explanation_stats as (
    select user_id, count(*)::int as explanations, (count(*) filter (where accepted))::int as accepted,
      min(created_at) as first_at, max(created_at) as last_at
    from public.joke_explanations group by user_id
  ),
  rows as (
    select a.user_id,
      greatest(p.last_seen_at, js.last_at, rs.last_at, es.last_at) as last_active_at,
      jsonb_build_object(
        'id', a.user_id,
        'name', coalesce(p.display_name, js.author_name),
        'email', p.email,
        'avatar_path', case when p.avatar_source = 'upload' then p.avatar_path end,
        'google_url', p.google_url,
        'is_superadmin', coalesce(p.is_superadmin, false),
        'has_profile', p.user_id is not null,
        'jokes', coalesce(js.jokes, 0),
        'ratings', coalesce(rs.ratings, 0),
        'funny', coalesce(rs.funny, 0),
        'explanations', coalesce(es.explanations, 0),
        'accepted_explanations', coalesce(es.accepted, 0),
        'first_seen_at', least(p.created_at, js.first_at, rs.first_at, es.first_at),
        'last_active_at', greatest(p.last_seen_at, js.last_at, rs.last_at, es.last_at)
      ) as account
    from accounts a
    left join public.user_profiles p on p.user_id = a.user_id
    left join joke_stats js on js.user_id = a.user_id
    left join rating_stats rs on rs.user_id = a.user_id
    left join explanation_stats es on es.user_id = a.user_id
  )
  select coalesce(jsonb_agg(account order by last_active_at desc nulls last, user_id), '[]'::jsonb) from rows;
$$;

-- Every AI-generated version with its joke and rating totals, newest first.
create function public.admin_media()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'audience', a.audience,
    'body', a.body,
    'gloss', a.gloss,
    'punchline_core', a.punchline_core,
    'notes', a.notes,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'funny', s.funny,
    'not_funny', s.not_funny,
    'joke', jsonb_build_object(
      'id', j.id,
      'body', j.body,
      'source_language', j.source_language,
      'origin', j.origin,
      'source_label', j.source_label,
      'author_name', j.author_name,
      'adult', j.adult,
      'explanation', j.explanation,
      'explanation_source', j.explanation_source,
      'created_at', j.created_at
    )
  ) order by j.created_at desc, j.id desc, array_position(array['en', 'es', 'zh'], a.audience)), '[]'::jsonb)
  from public.joke_adaptations a
  join public.jokes j on j.id = a.joke_id
  cross join lateral (
    select (count(*) filter (where r.funny))::int as funny, (count(*) filter (where not r.funny))::int as not_funny
    from public.adaptation_ratings r where r.adaptation_id = a.id
  ) s;
$$;

-- The newest ratings with the version, joke, and rater they belong to.
create function public.admin_ratings(p_limit int default 1000)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(item.rating order by item.created_at desc, item.adaptation_id desc), '[]'::jsonb)
  from (
    select r.created_at, r.adaptation_id, jsonb_build_object(
      'adaptation_id', r.adaptation_id,
      'user_id', r.user_id,
      'funny', r.funny,
      'created_at', r.created_at,
      'updated_at', r.updated_at,
      'rater_name', coalesce(p.display_name, (
        select j2.author_name from public.jokes j2 where j2.author_id = r.user_id order by j2.created_at desc limit 1
      )),
      'rater_email', p.email,
      'audience', a.audience,
      'version', a.body,
      'joke_id', j.id,
      'joke', j.body,
      'source_language', j.source_language
    ) as rating
    from public.adaptation_ratings r
    join public.joke_adaptations a on a.id = r.adaptation_id
    join public.jokes j on j.id = a.joke_id
    left join public.user_profiles p on p.user_id = r.user_id
    order by r.created_at desc, r.adaptation_id desc
    limit greatest(p_limit, 0)
  ) item;
$$;

-- Dashboard statistics. Activity counts cover the last p_days days and the same span before it;
-- everything else describes the whole collection.
create function public.admin_dashboard(p_days int default 30)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with bounds as (
    select d as days,
      date_trunc('day', now()) - make_interval(days => d - 1) as since,
      date_trunc('day', now()) - make_interval(days => 2 * d - 1) as previous_since
    from (select least(greatest(coalesce(p_days, 30), 1), 366) as d) input
  ),
  accounts as (
    select user_id from public.user_profiles
    union select author_id from public.jokes where author_id is not null
    union select user_id from public.adaptation_ratings
    union select user_id from public.joke_explanations
  ),
  activity as (
    select author_id as user_id, created_at as at from public.jokes where author_id is not null
    union all select user_id, updated_at from public.adaptation_ratings
    union all select user_id, created_at from public.joke_explanations
    union all select user_id, last_seen_at from public.user_profiles where last_seen_at is not null
  ),
  version_stats as (
    select a.id, a.joke_id, a.audience, a.body, a.notes, a.punchline_core, s.funny, s.not_funny
    from public.joke_adaptations a
    cross join lateral (
      select (count(*) filter (where r.funny))::int as funny, (count(*) filter (where not r.funny))::int as not_funny
      from public.adaptation_ratings r where r.adaptation_id = a.id
    ) s
  ),
  daily as (
    select d.day, coalesce(jd.n, 0) as jokes, coalesce(rd.n, 0) as ratings
    from bounds b
    cross join generate_series(b.since, date_trunc('day', now()), interval '1 day') as d(day)
    left join (select date_trunc('day', created_at) as day, count(*)::int as n from public.jokes group by 1) jd on jd.day = d.day
    left join (select date_trunc('day', created_at) as day, count(*)::int as n from public.adaptation_ratings group by 1) rd on rd.day = d.day
  ),
  -- Comic mechanisms named in each joke's punchline commentary; a joke can use several.
  joke_cores as (
    select a.joke_id, lower(string_agg(coalesce(a.punchline_core->>'en', ''), ' ')) as text
    from public.joke_adaptations a group by a.joke_id
  ),
  mechanisms as (
    select m.id, m.position, (count(*) filter (where c.text ~ m.pattern))::int as jokes
    from (values
      ('reversal', 1, 'revers|twist|reveal|subver|expectation|turns out|collaps'),
      ('deadpan', 2, 'deadpan|matter-of-fact|understat|\mflat\M'),
      ('literal', 3, 'literal'),
      ('absurd', 4, 'absurd|exaggerat|hyperbol|ridicul'),
      ('wordplay', 5, '\mpuns?\M|wordplay|double meaning|double entendre|two meanings|homophone|sound-?alike|sounds like|rhym'),
      ('irony', 6, 'iron|sarcas|parod|\mmock'),
      ('self_mockery', 7, 'self-deprecat|self-mock|self-dismiss'),
      ('innuendo', 8, 'innuendo|sexual|euphemis|risqu')
    ) as m(id, position, pattern)
    cross join joke_cores c
    group by m.id, m.position
  ),
  -- How much each version in another language had to change, read from the platform's adaptation notes.
  rewrites as (
    select v.audience,
      case
        when v.notes->>'en' ~* '(no (cultural )?(substitution|reference|swap|change)s?|needed no|unchanged|verbatim|exactly as written|already (works?|lands?))' then 'kept'
        when v.notes->>'en' ~* '(swap|replac|substitut|became|becomes|turned into|recast|instead of)' then 'swapped'
        else 'adapted'
      end as kind
    from version_stats v join public.jokes j on j.id = v.joke_id
    where v.audience <> j.source_language
  ),
  rated as (
    select v.id, v.audience, v.body, v.funny, v.not_funny, j.id as joke_id, j.body as joke_body, j.source_language
    from version_stats v join public.jokes j on j.id = v.joke_id
    where v.funny + v.not_funny > 0
  )
  select jsonb_build_object(
    'days', b.days,
    'since', b.since,
    'totals', jsonb_build_object(
      'jokes', (select count(*) from public.jokes),
      'versions', (select count(*) from public.joke_adaptations),
      'edited_versions', (select count(*) from public.joke_adaptations where updated_at is not null),
      'ratings', (select count(*) from public.adaptation_ratings),
      'funny', (select count(*) from public.adaptation_ratings where funny),
      'accounts', (select count(*) from accounts),
      'superadmins', (select count(*) from public.user_profiles where is_superadmin),
      'adult_jokes', (select count(*) from public.jokes where adult),
      'explanations', (select count(*) from public.joke_explanations),
      'accepted_explanations', (select count(*) from public.joke_explanations where accepted)
    ),
    'period', jsonb_build_object(
      'jokes', (select count(*) from public.jokes where created_at >= b.since),
      'previous_jokes', (select count(*) from public.jokes where created_at >= b.previous_since and created_at < b.since),
      'versions', (select count(*) from public.joke_adaptations where created_at >= b.since),
      'previous_versions', (select count(*) from public.joke_adaptations where created_at >= b.previous_since and created_at < b.since),
      'ratings', (select count(*) from public.adaptation_ratings where created_at >= b.since),
      'previous_ratings', (select count(*) from public.adaptation_ratings where created_at >= b.previous_since and created_at < b.since),
      'funny', (select count(*) from public.adaptation_ratings where funny and created_at >= b.since),
      'previous_funny', (select count(*) from public.adaptation_ratings where funny and created_at >= b.previous_since and created_at < b.since),
      'active_accounts', (select count(distinct user_id) from activity where at >= b.since),
      'previous_active_accounts', (select count(distinct user_id) from activity where at >= b.previous_since and at < b.since)
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'jokes', jokes, 'ratings', ratings) order by day), '[]'::jsonb) from daily),
    'origins', (
      select coalesce(jsonb_agg(jsonb_build_object('origin', origin, 'source_label', source_label, 'jokes', n) order by n desc), '[]'::jsonb)
      from (select origin, source_label, count(*)::int as n from public.jokes group by origin, source_label) o
    ),
    'source_languages', (
      select coalesce(jsonb_agg(jsonb_build_object('language', source_language, 'jokes', n) order by n desc), '[]'::jsonb)
      from (select source_language, count(*)::int as n from public.jokes group by source_language) l
    ),
    'cultures', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'audience', audience, 'versions', versions, 'funny', funny, 'not_funny', not_funny, 'median_length', median_length
      ) order by array_position(array['en', 'es', 'zh'], audience)), '[]'::jsonb)
      from (
        select audience, count(*)::int as versions, sum(funny)::int as funny, sum(not_funny)::int as not_funny,
          percentile_cont(0.5) within group (order by char_length(body)) as median_length
        from version_stats group by audience
      ) c
    ),
    -- Median length of a version relative to its original, per source and target language.
    'stretch', (
      select coalesce(jsonb_agg(jsonb_build_object('source_language', source_language, 'audience', audience, 'versions', versions, 'ratio', ratio)
        order by source_language, array_position(array['en', 'es', 'zh'], audience)), '[]'::jsonb)
      from (
        select j.source_language, v.audience, count(*)::int as versions,
          round((percentile_cont(0.5) within group (order by char_length(v.body)::float8 / char_length(j.body)))::numeric, 2) as ratio
        from version_stats v join public.jokes j on j.id = v.joke_id
        where v.audience <> j.source_language
        group by j.source_language, v.audience
      ) s
    ),
    'mechanisms', (
      select jsonb_build_object(
        'jokes', (select count(*) from joke_cores),
        'items', coalesce(jsonb_agg(jsonb_build_object('id', id, 'jokes', jokes) order by jokes desc, position), '[]'::jsonb)
      ) from mechanisms
    ),
    'rewrites', (
      select coalesce(jsonb_agg(jsonb_build_object('audience', audience, 'kept', kept, 'adapted', adapted, 'swapped', swapped)
        order by array_position(array['en', 'es', 'zh'], audience)), '[]'::jsonb)
      from (
        select audience, (count(*) filter (where kind = 'kept'))::int as kept, (count(*) filter (where kind = 'adapted'))::int as adapted,
          (count(*) filter (where kind = 'swapped'))::int as swapped
        from rewrites group by audience
      ) r
    ),
    'favorites', (
      select coalesce(jsonb_agg(to_jsonb(f) order by f.funny desc, f.not_funny, f.id), '[]'::jsonb)
      from (select * from rated where funny > 0 order by funny desc, not_funny, id limit 5) f
    ),
    'lost', (
      select coalesce(jsonb_agg(to_jsonb(l) order by l.not_funny desc, l.funny, l.id), '[]'::jsonb)
      from (select * from rated where not_funny > 0 order by not_funny desc, funny, id limit 5) l
    )
  )
  from bounds b;
$$;

revoke all on function public.admin_users(), public.admin_media(), public.admin_ratings(int), public.admin_dashboard(int)
  from public, anon, authenticated;
grant execute on function public.admin_users(), public.admin_media(), public.admin_ratings(int), public.admin_dashboard(int)
  to service_role;

commit;
