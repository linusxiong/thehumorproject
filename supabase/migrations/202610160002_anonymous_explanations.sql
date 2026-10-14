begin;

-- Explanations are shown as "from the author" or "from a community member", never with a name.
alter table public.jokes add column explanation_source text check (explanation_source in ('author', 'community'));
-- Every explanation so far came through community re-adaptation.
update public.jokes set explanation_source = 'community' where explanation is not null;
alter table public.jokes
  add constraint jokes_explanation_pairing_check check ((explanation is null) = (explanation_source is null));
alter table public.jokes drop column explained_by;
grant update (explanation_source) on public.jokes to service_role;
-- The account digest is kept for the daily limit; the member's name is never needed.
alter table public.joke_explanations drop column author_name;

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
      'adult', j.adult,
      'explanation', j.explanation,
      'explanation_source', j.explanation_source,
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

-- An explanation given while sharing comes from the author.
drop function public.create_joke(text, text, text, text, jsonb, text, text, timestamptz, boolean, text, text);
create function public.create_joke(
  p_author_id text,
  p_author_name text,
  p_body text,
  p_source_language text,
  p_adaptations jsonb,
  p_origin text default 'member',
  p_source_label text default null,
  p_created_at timestamptz default now(),
  p_adult boolean default false,
  p_explanation text default null
)
returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  new_id bigint;
begin
  if jsonb_typeof(p_adaptations) is distinct from 'array' or jsonb_array_length(p_adaptations) = 0 then
    raise exception 'create_joke needs at least one adaptation';
  end if;
  insert into public.jokes (author_id, author_name, body, source_language, origin, source_label, created_at, adult, explanation, explanation_source)
  values (p_author_id, p_author_name, p_body, p_source_language, p_origin, p_source_label, p_created_at, p_adult, p_explanation,
    case when p_explanation is null then null else 'author' end)
  returning id into new_id;
  insert into public.joke_adaptations (joke_id, audience, body, gloss, punchline_core, notes, created_at)
  select new_id, x.audience, x.body, x.gloss, x.punchline_core, x.notes, p_created_at
  from jsonb_to_recordset(p_adaptations)
    as x(audience text, body text, gloss jsonb, punchline_core jsonb, notes jsonb);
  return new_id;
end;
$$;
revoke all on function public.create_joke(text, text, text, text, jsonb, text, text, timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.create_joke(text, text, text, text, jsonb, text, text, timestamptz, boolean, text) to service_role;

-- A community explanation is recorded against the account (for the daily limit) and shown anonymously.
drop function public.readapt_joke(bigint, text, text, text, boolean, jsonb);
create function public.readapt_joke(
  p_joke_id bigint,
  p_user_id text,
  p_explanation text,
  p_adult boolean,
  p_adaptations jsonb
)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if jsonb_typeof(p_adaptations) is distinct from 'array' or jsonb_array_length(p_adaptations) = 0 then
    raise exception 'readapt_joke needs at least one adaptation';
  end if;
  update public.jokes set adult = p_adult, explanation = p_explanation, explanation_source = 'community'
  where id = p_joke_id;
  if not found then
    raise exception 'joke % does not exist', p_joke_id using errcode = 'no_data_found';
  end if;
  insert into public.joke_explanations (joke_id, user_id, explanation, accepted)
  values (p_joke_id, p_user_id, p_explanation, true);
  delete from public.joke_adaptations where joke_id = p_joke_id;
  insert into public.joke_adaptations (joke_id, audience, body, gloss, punchline_core, notes)
  select p_joke_id, x.audience, x.body, x.gloss, x.punchline_core, x.notes
  from jsonb_to_recordset(p_adaptations)
    as x(audience text, body text, gloss jsonb, punchline_core jsonb, notes jsonb);
end;
$$;
revoke all on function public.readapt_joke(bigint, text, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.readapt_joke(bigint, text, text, boolean, jsonb) to service_role;

commit;
