begin;

-- Media chains: prompt chains built in Punchline Studio, a separate superadmin tool on this database. Unlike the
-- preview and adaptation chains the site runs, whose prompts live in lib/claude.ts, a media chain keeps its prompts
-- here: each step's text goes to the model along with the output of the step before it, and the first step also
-- sees the image or text a superadmin supplied. Media chains never join the mix and the site never runs them.

alter table public.prompt_chains drop constraint prompt_chains_purpose_check;
alter table public.prompt_chains add constraint prompt_chains_purpose_check check (purpose in ('preview', 'adaptation', 'media'));

alter table public.prompt_chain_steps add column prompt text check (length(prompt) between 1 and 20000);
alter table public.prompt_chain_steps alter column description drop not null;
alter table public.prompt_chain_steps drop constraint prompt_chain_steps_kind_check;
alter table public.prompt_chain_steps add constraint prompt_chain_steps_kind_check check (kind in ('analysis', 'adaptation', 'prompt'));
-- A prompt step carries its own text; the other kinds keep theirs in lib/claude.ts and describe it here.
alter table public.prompt_chain_steps add constraint prompt_chain_steps_prompt_matches_kind check ((kind = 'prompt') = (prompt is not null));
alter table public.prompt_chain_steps add constraint prompt_chain_steps_described_unless_prompt check (kind = 'prompt' or description is not null);
-- Deferrable so one statement can move several steps; a plain unique constraint is checked row by row.
alter table public.prompt_chain_steps drop constraint prompt_chain_steps_chain_id_position_key;
alter table public.prompt_chain_steps add constraint prompt_chain_steps_chain_id_position_key
  unique (chain_id, position) deferrable initially immediate;

-- Studio runs share the site's request and model-call logs.
alter table public.generation_requests drop constraint generation_requests_purpose_check;
alter table public.generation_requests add constraint generation_requests_purpose_check check (purpose in ('preview', 'adaptation', 'media'));
alter table public.generation_requests drop constraint generation_requests_source_check;
alter table public.generation_requests add constraint generation_requests_source_check check (source in ('share', 'explanation', 'admin', 'studio'));
alter table public.llm_responses drop constraint llm_responses_kind_check;
alter table public.llm_responses add constraint llm_responses_kind_check check (kind in ('analysis', 'adaptation', 'prompt'));

-- What a media chain produced: the supplied image and text, and every step's output as it ran, kept as a snapshot
-- so later edits to the chain do not change past results. Failed runs stay in the logs and never appear here.
create table public.chain_media (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  request_id bigint not null unique references public.generation_requests (id) on delete restrict,
  image_path text check (image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  input_text text check (length(input_text) between 1 and 2000),
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) > 0),
  created_at timestamptz not null default now(),
  constraint chain_media_has_input check (image_path is not null or input_text is not null)
);
create index chain_media_chain_id_created_at_idx on public.chain_media (chain_id, created_at desc);

alter table public.chain_media enable row level security;
revoke all on public.chain_media from public, anon, authenticated, service_role;
grant select, insert on public.chain_media to service_role;
grant usage on sequence public.chain_media_id_seq to service_role;

-- Images given to media chains. Private, unlike avatars: the studio shows them through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chain-media', 'chain-media', false, 4194304, array['image/jpeg', 'image/png', 'image/webp']);

-- The site's chain pages and mix cover the chains the site runs. Every purpose the mix serves keeps a chain above 0.
create or replace function public.set_prompt_chain_mix(p_weights jsonb)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  insert into public.prompt_chain_mix (chain_id, weight, updated_at)
  select (w->>'chain_id')::bigint, (w->>'weight')::int, now()
  from jsonb_array_elements(p_weights) w
  on conflict (chain_id) do update set weight = excluded.weight, updated_at = excluded.updated_at;
  if exists (
    select 1 from public.prompt_chains c left join public.prompt_chain_mix m on m.chain_id = c.id
    where c.purpose <> 'media'
    group by c.purpose having coalesce(sum(m.weight), 0) = 0
  ) then
    raise exception 'Every purpose needs a chain with a weight above 0.' using errcode = 'check_violation';
  end if;
end;
$$;

create or replace function public.admin_prompt_chains()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with latest as (
    select distinct on (r.joke_id) r.joke_id, r.chain_id
    from public.generation_requests r
    where r.purpose = 'adaptation' and r.status = 'succeeded' and r.joke_id is not null
    order by r.joke_id, r.created_at desc, r.id desc
  ),
  outcomes as (
    select l.chain_id, count(distinct l.joke_id)::int as jokes, count(distinct a.id)::int as versions,
      (count(ar.adaptation_id) filter (where ar.funny))::int as funny, (count(ar.adaptation_id) filter (where not ar.funny))::int as not_funny
    from latest l
    join public.joke_adaptations a on a.joke_id = l.joke_id
    left join public.adaptation_ratings ar on ar.adaptation_id = a.id
    group by l.chain_id
  ),
  usage as (
    select chain_id, count(*)::int as requests, (count(*) filter (where status = 'succeeded'))::int as succeeded,
      (count(*) filter (where status = 'failed'))::int as failed, max(created_at) as last_used_at
    from public.generation_requests group by chain_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'slug', c.slug,
    'purpose', c.purpose,
    'name', c.name,
    'description', c.description,
    'created_at', c.created_at,
    'weight', coalesce(m.weight, 0),
    'mix_updated_at', m.updated_at,
    'requests', coalesce(u.requests, 0),
    'succeeded', coalesce(u.succeeded, 0),
    'failed', coalesce(u.failed, 0),
    'last_used_at', u.last_used_at,
    'jokes', coalesce(o.jokes, 0),
    'versions', coalesce(o.versions, 0),
    'funny', coalesce(o.funny, 0),
    'not_funny', coalesce(o.not_funny, 0),
    'steps', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'position', s.position, 'kind', s.kind, 'name', s.name, 'description', s.description,
        'effort', s.effort, 'max_tokens', s.max_tokens,
        'model', jsonb_build_object('id', lm.id, 'name', lm.name, 'api_model_id', lm.api_model_id, 'provider', p.name)
      ) order by s.position), '[]'::jsonb)
      from public.prompt_chain_steps s
      join public.llm_models lm on lm.id = s.model_id
      join public.llm_providers p on p.id = lm.provider_id
      where s.chain_id = c.id
    )
  ) order by array_position(array['preview', 'adaptation'], c.purpose), c.id), '[]'::jsonb)
  from public.prompt_chains c
  left join public.prompt_chain_mix m on m.chain_id = c.id
  left join usage u on u.chain_id = c.id
  left join outcomes o on o.chain_id = c.id
  where c.purpose <> 'media';
$$;

-- The studio's only way to change chains. The server key keeps read-only access to both tables, so these functions
-- run as their owner and touch media chains alone: the chains the site runs still change only through migrations.
-- Each returns null, or false, when the chain or step is not a media chain's (the Route Handlers answer 404).

create function public.studio_create_chain(p_slug text, p_name text, p_description text)
returns bigint
language sql volatile security definer set search_path = ''
as $$
  insert into public.prompt_chains (slug, purpose, name, description)
  values (p_slug, 'media', p_name, p_description)
  returning id;
$$;

create function public.studio_update_chain(p_chain_id bigint, p_name text, p_description text)
returns boolean
language sql volatile security definer set search_path = ''
as $$
  with changed as (
    update public.prompt_chains set name = p_name, description = p_description
    where id = p_chain_id and purpose = 'media'
    returning 1
  )
  select exists (select 1 from changed);
$$;

-- Returns the chain's image paths for the caller to remove from storage, or null when there is no such chain.
-- Its media rows go with it; the request logs stay, as they do for any deleted chain.
create function public.studio_delete_chain(p_chain_id bigint)
returns text[]
language plpgsql volatile security definer set search_path = ''
as $$
declare
  paths text[];
begin
  perform 1 from public.prompt_chains where id = p_chain_id and purpose = 'media' for update;
  if not found then return null; end if;
  select coalesce(array_agg(image_path) filter (where image_path is not null), '{}') into paths
  from public.chain_media where chain_id = p_chain_id;
  delete from public.prompt_chains where id = p_chain_id;
  return paths;
end;
$$;

-- Adds a step at the end. Locking the chain keeps concurrent edits from reading the same last position.
create function public.studio_create_step(p_chain_id bigint, p_name text, p_prompt text, p_model_id bigint, p_effort text, p_max_tokens int)
returns bigint
language plpgsql volatile security definer set search_path = ''
as $$
declare
  created bigint;
begin
  perform 1 from public.prompt_chains where id = p_chain_id and purpose = 'media' for update;
  if not found then return null; end if;
  insert into public.prompt_chain_steps (chain_id, position, kind, name, prompt, model_id, effort, max_tokens)
  select p_chain_id, coalesce(max(position), 0) + 1, 'prompt', p_name, p_prompt, p_model_id, p_effort, p_max_tokens
  from public.prompt_chain_steps where chain_id = p_chain_id
  returning id into created;
  return created;
end;
$$;

create function public.studio_update_step(p_chain_id bigint, p_step_id bigint, p_name text, p_prompt text, p_model_id bigint, p_effort text, p_max_tokens int)
returns boolean
language sql volatile security definer set search_path = ''
as $$
  with changed as (
    update public.prompt_chain_steps s
    set name = p_name, prompt = p_prompt, model_id = p_model_id, effort = p_effort, max_tokens = p_max_tokens
    from public.prompt_chains c
    where s.id = p_step_id and s.chain_id = p_chain_id and c.id = s.chain_id and c.purpose = 'media'
    returning 1
  )
  select exists (select 1 from changed);
$$;

-- Deletes a step and closes the gap, so positions always run 1, 2, 3.
create function public.studio_delete_step(p_chain_id bigint, p_step_id bigint)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  removed int;
begin
  perform 1 from public.prompt_chains where id = p_chain_id and purpose = 'media' for update;
  if not found then return false; end if;
  delete from public.prompt_chain_steps where id = p_step_id and chain_id = p_chain_id returning position into removed;
  if removed is null then return false; end if;
  update public.prompt_chain_steps set position = position - 1 where chain_id = p_chain_id and position > removed;
  return true;
end;
$$;

-- Applies a new order given as every step of the chain exactly once. False when the list does not match the chain,
-- for example after another tab added or removed a step.
create function public.studio_reorder_steps(p_chain_id bigint, p_step_ids bigint[])
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform 1 from public.prompt_chains where id = p_chain_id and purpose = 'media' for update;
  if not found then return false; end if;
  if array(select id from public.prompt_chain_steps where chain_id = p_chain_id order by id)
    is distinct from array(select distinct unnest(p_step_ids) order by 1)
    or cardinality(p_step_ids) <> (select count(*) from public.prompt_chain_steps where chain_id = p_chain_id) then
    return false;
  end if;
  update public.prompt_chain_steps s set position = o.position
  from unnest(p_step_ids) with ordinality o(id, position)
  where s.id = o.id and s.chain_id = p_chain_id;
  return true;
end;
$$;

revoke all on function public.studio_create_chain(text, text, text), public.studio_update_chain(bigint, text, text),
  public.studio_delete_chain(bigint), public.studio_create_step(bigint, text, text, bigint, text, int),
  public.studio_update_step(bigint, bigint, text, text, bigint, text, int), public.studio_delete_step(bigint, bigint),
  public.studio_reorder_steps(bigint, bigint[])
  from public, anon, authenticated;
grant execute on function public.studio_create_chain(text, text, text), public.studio_update_chain(bigint, text, text),
  public.studio_delete_chain(bigint), public.studio_create_step(bigint, text, text, bigint, text, int),
  public.studio_update_step(bigint, bigint, text, text, bigint, text, int), public.studio_delete_step(bigint, bigint),
  public.studio_reorder_steps(bigint, bigint[])
  to service_role;

commit;
