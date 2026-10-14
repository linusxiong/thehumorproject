begin;

-- Jokes may be written in any supported language and come from demos, members, or imports.
-- author_id is set exactly for member jokes; source_label credits imported posts (e.g. "Qiushibaike").
alter table public.jokes
  add column source_language text not null default 'en' check (source_language in ('en', 'es', 'zh')),
  add column origin text not null default 'member' check (origin in ('demo', 'member', 'import')),
  add column source_label text check (length(source_label) between 1 and 100);
update public.jokes set origin = 'demo' where author_id is null;
alter table public.jokes add constraint jokes_origin_author_check check ((origin = 'member') = (author_id is not null));

-- Commentary is localized per interface language: {"en": ..., "es": ..., "zh": ...}.
-- gloss replaces the English-only back-translation.
alter table public.joke_adaptations add column gloss jsonb;
update public.joke_adaptations set gloss = jsonb_build_object('en', back_translation);
alter table public.joke_adaptations
  alter column gloss set not null,
  drop column back_translation,
  drop constraint joke_adaptations_punchline_core_check,
  drop constraint joke_adaptations_notes_check,
  alter column punchline_core type jsonb using jsonb_build_object('en', punchline_core),
  alter column notes type jsonb using jsonb_build_object('en', notes),
  add constraint joke_adaptations_gloss_check check (jsonb_typeof(gloss) = 'object'),
  add constraint joke_adaptations_punchline_core_check check (jsonb_typeof(punchline_core) = 'object'),
  add constraint joke_adaptations_notes_check check (jsonb_typeof(notes) = 'object');

-- Newest jokes with every version, rating totals, and the given member's own rating.
-- Totals are always returned; the API hides them until the viewer has rated.
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
    where p_joke_id is null or j.id = p_joke_id
    order by j.created_at desc, j.id desc
    limit greatest(p_limit, 0)
  ) feed;
$$;
revoke all on function public.joke_feed(text, bigint, int) from public, anon, authenticated;
grant execute on function public.joke_feed(text, bigint, int) to service_role;

-- Store a joke and all of its generated versions atomically.
drop function public.create_joke(text, text, text, jsonb);
create function public.create_joke(
  p_author_id text,
  p_author_name text,
  p_body text,
  p_source_language text,
  p_adaptations jsonb,
  p_origin text default 'member',
  p_source_label text default null,
  p_created_at timestamptz default now()
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
  insert into public.jokes (author_id, author_name, body, source_language, origin, source_label, created_at)
  values (p_author_id, p_author_name, p_body, p_source_language, p_origin, p_source_label, p_created_at)
  returning id into new_id;
  insert into public.joke_adaptations (joke_id, audience, body, gloss, punchline_core, notes, created_at)
  select new_id, x.audience, x.body, x.gloss, x.punchline_core, x.notes, p_created_at
  from jsonb_to_recordset(p_adaptations)
    as x(audience text, body text, gloss jsonb, punchline_core jsonb, notes jsonb);
  return new_id;
end;
$$;
revoke all on function public.create_joke(text, text, text, text, jsonb, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.create_joke(text, text, text, text, jsonb, text, text, timestamptz) to service_role;

commit;
