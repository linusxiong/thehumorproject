begin;

-- AI configuration, AI request logs, and sign-up access lists for the admin area. Every table keeps RLS on with
-- no policies, and only the server-only key has the privileges granted below; read-only tables stay read-only
-- for the app itself and change only through migrations.

-- LLM providers and the models the app calls. Prompt chain steps name a model, so changing a model's API id
-- changes every step that uses it.
create table public.llm_providers (
  id bigint generated always as identity primary key,
  name text not null check (length(name) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create unique index llm_providers_name_key on public.llm_providers (lower(name));

create table public.llm_models (
  id bigint generated always as identity primary key,
  provider_id bigint not null references public.llm_providers (id) on delete restrict,
  name text not null check (length(name) between 1 and 100),
  api_model_id text not null unique check (api_model_id ~ '^[a-z0-9][a-z0-9._:/-]{0,99}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index llm_models_provider_id_idx on public.llm_models (provider_id);

-- Prompt chains: the AI pipelines the app runs. A chain serves one purpose, either the punchline preview a member
-- confirms before sharing or the adaptation that writes the three cultural versions, and its steps run in order.
-- Chains and steps are defined here and are read-only in the admin area; the prompt text lives in lib/claude.ts.
create table public.prompt_chains (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,60}$'),
  purpose text not null check (purpose in ('preview', 'adaptation')),
  name text not null check (length(name) between 1 and 100),
  description text not null check (length(description) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.prompt_chain_steps (
  id bigint generated always as identity primary key,
  chain_id bigint not null references public.prompt_chains (id) on delete cascade,
  position int not null check (position between 1 and 10),
  kind text not null check (kind in ('analysis', 'adaptation')),
  name text not null check (length(name) between 1 and 100),
  description text not null check (length(description) between 1 and 1000),
  model_id bigint not null references public.llm_models (id) on delete restrict,
  effort text not null check (effort in ('low', 'medium', 'high', 'xhigh', 'max')),
  max_tokens int not null check (max_tokens between 1024 and 64000),
  unique (chain_id, position)
);
create index prompt_chain_steps_model_id_idx on public.prompt_chain_steps (model_id);

-- The mix: how often each chain runs among the chains of its purpose. Each request picks one chain at random,
-- weighted by these numbers; a weight of 0 turns a chain off.
create table public.prompt_chain_mix (
  chain_id bigint primary key references public.prompt_chains (id) on delete cascade,
  weight int not null default 0 check (weight between 0 and 100),
  updated_at timestamptz
);

-- Glossary of culture-specific terms (slang, references, sound-alikes) and what they mean. When a joke contains
-- a term, its entry is sent to the model along with the joke.
create table public.terms (
  id bigint generated always as identity primary key,
  term text not null check (length(term) between 1 and 100),
  language text not null check (language in ('en', 'es', 'zh')),
  definition text not null check (length(definition) between 1 and 1000),
  example text check (length(example) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create unique index terms_language_term_key on public.terms (language, lower(term));

-- Reference adaptations the editors consider excellent: a joke in its source language, its versions for the other
-- two cultures, and optionally why it is funny and why the adaptation works. The ten newest are sent with every
-- adaptation request as examples to follow.
create table public.generation_examples (
  id bigint generated always as identity primary key,
  source_language text not null check (source_language in ('en', 'es', 'zh')),
  body_en text not null check (length(body_en) between 1 and 2000),
  body_es text not null check (length(body_es) between 1 and 2000),
  body_zh text not null check (length(body_zh) between 1 and 2000),
  explanation text check (length(explanation) between 5 and 500),
  notes text check (length(notes) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- One row per AI request made for a member or superadmin, with its outcome. Inputs include drafts that were
-- previewed but never shared.
create table public.generation_requests (
  id bigint generated always as identity primary key,
  purpose text not null check (purpose in ('preview', 'adaptation')),
  source text not null check (source in ('share', 'explanation', 'admin')),
  chain_id bigint references public.prompt_chains (id) on delete set null,
  user_id text check (length(user_id) > 0),
  joke_id bigint references public.jokes (id) on delete set null,
  input text not null check (length(input) between 1 and 2000),
  explanation text check (length(explanation) between 1 and 500),
  locale text check (locale in ('en', 'es', 'zh')),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'unsuitable', 'rejected', 'failed')),
  error text check (length(error) between 1 and 500),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index generation_requests_created_at_idx on public.generation_requests (created_at desc);
create index generation_requests_joke_id_idx on public.generation_requests (joke_id);
create index generation_requests_chain_id_idx on public.generation_requests (chain_id);

-- One row per model call within a request: the step, the model, what was sent after the system prompt,
-- token usage, timing, and the model's JSON answer.
create table public.llm_responses (
  id bigint generated always as identity primary key,
  request_id bigint not null references public.generation_requests (id) on delete cascade,
  step_id bigint references public.prompt_chain_steps (id) on delete set null,
  kind text not null check (kind in ('analysis', 'adaptation')),
  model_id bigint references public.llm_models (id) on delete set null,
  model text not null check (length(model) between 1 and 100),
  effort text not null check (effort in ('low', 'medium', 'high', 'xhigh', 'max')),
  prompt text not null check (length(prompt) between 1 and 20000),
  status text not null check (status in ('succeeded', 'refused', 'failed')),
  http_status int,
  stop_reason text check (length(stop_reason) between 1 and 50),
  input_tokens int check (input_tokens >= 0),
  output_tokens int check (output_tokens >= 0),
  cache_read_input_tokens int check (cache_read_input_tokens >= 0),
  cache_creation_input_tokens int check (cache_creation_input_tokens >= 0),
  duration_ms int not null check (duration_ms >= 0),
  answer jsonb,
  error text check (length(error) between 1 and 500),
  created_at timestamptz not null default now()
);
create index llm_responses_request_id_idx on public.llm_responses (request_id);
create index llm_responses_created_at_idx on public.llm_responses (created_at desc);

-- Sign-up access lists. While both are empty, every Google account may sign in. Once either has an entry, only
-- verified emails on a listed domain or on the email list may sign in, plus superadmins (see signup_allowed).
create table public.allowed_signup_domains (
  id bigint generated always as identity primary key,
  domain text not null unique check (length(domain) <= 253 and domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.whitelisted_emails (
  id bigint generated always as identity primary key,
  email text not null unique check (length(email) between 3 and 320 and email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.llm_providers enable row level security;
alter table public.llm_models enable row level security;
alter table public.prompt_chains enable row level security;
alter table public.prompt_chain_steps enable row level security;
alter table public.prompt_chain_mix enable row level security;
alter table public.terms enable row level security;
alter table public.generation_examples enable row level security;
alter table public.generation_requests enable row level security;
alter table public.llm_responses enable row level security;
alter table public.allowed_signup_domains enable row level security;
alter table public.whitelisted_emails enable row level security;
revoke all on public.llm_providers, public.llm_models, public.prompt_chains, public.prompt_chain_steps, public.prompt_chain_mix,
  public.terms, public.generation_examples, public.generation_requests, public.llm_responses,
  public.allowed_signup_domains, public.whitelisted_emails
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.llm_providers, public.llm_models, public.terms, public.generation_examples,
  public.allowed_signup_domains, public.whitelisted_emails to service_role;
grant select on public.prompt_chains, public.prompt_chain_steps to service_role;
grant select, insert, update on public.prompt_chain_mix, public.generation_requests to service_role;
grant select, insert on public.llm_responses to service_role;
grant usage on sequence public.llm_providers_id_seq, public.llm_models_id_seq, public.terms_id_seq, public.generation_examples_id_seq,
  public.generation_requests_id_seq, public.llm_responses_id_seq, public.allowed_signup_domains_id_seq, public.whitelisted_emails_id_seq
  to service_role;

-- The model and chains the app ran before this migration, plus two alternatives that start switched off.
insert into public.llm_providers (name) values ('Anthropic');
insert into public.llm_models (provider_id, name, api_model_id)
select id, 'Claude Haiku 5.5', 'claude-haiku-5-5' from public.llm_providers where name = 'Anthropic';

insert into public.prompt_chains (slug, purpose, name, description) values
  ('punchline-preview', 'preview', 'Punchline preview',
    'Explains what makes a joke funny, in the member''s interface language, before it is shared, so the author can confirm or correct the reading.'),
  ('direct-adaptation', 'adaptation', 'Direct adaptation',
    'Adapts the joke for English-, Spanish-, and Chinese-speaking readers in one request, following the author''s or a community member''s explanation when there is one.'),
  ('careful-adaptation', 'adaptation', 'Careful adaptation',
    'The same adaptation with more thinking. Slower and more expensive; live requests can take a minute.'),
  ('read-then-adapt', 'adaptation', 'Read first, then adapt',
    'When nobody has explained the joke, first works out what makes it funny, then adapts it with that reading as the explanation. A human explanation, when given, replaces the first step.');

insert into public.prompt_chain_steps (chain_id, position, kind, name, description, model_id, effort, max_tokens)
select c.id, s.position, s.kind, s.name, s.description, m.id, s.effort, s.max_tokens
from (values
  ('punchline-preview', 1, 'analysis', 'Read the punchline',
    'Names the setup, the twist, and every hidden homophone, pun, double meaning, or innuendo, in the reader''s language.', 'medium', 8000),
  ('direct-adaptation', 1, 'adaptation', 'Adapt for three cultures',
    'Writes the English, Spanish, and Chinese versions with a translation, the core punchline, and adaptation notes for each.', 'medium', 16000),
  ('careful-adaptation', 1, 'adaptation', 'Adapt for three cultures',
    'Writes the English, Spanish, and Chinese versions with a translation, the core punchline, and adaptation notes for each.', 'high', 16000),
  ('read-then-adapt', 1, 'analysis', 'Read the punchline',
    'Explains in English what makes the joke funny. Skipped when the author or a community member explained the joke.', 'medium', 8000),
  ('read-then-adapt', 2, 'adaptation', 'Adapt for three cultures',
    'Writes the three versions, following the reading from step 1 (or the human explanation) as the authoritative one.', 'medium', 16000)
) as s(slug, position, kind, name, description, effort, max_tokens)
join public.prompt_chains c on c.slug = s.slug
cross join public.llm_models m
where m.api_model_id = 'claude-haiku-5-5';

insert into public.prompt_chain_mix (chain_id, weight)
select id, case when slug in ('punchline-preview', 'direct-adaptation') then 100 else 0 end from public.prompt_chains;

-- Sign-up gate, checked on every Google sign-in. Superadmins always pass, so the lists can never lock them out.
create function public.signup_allowed(p_email text)
returns boolean
language sql stable security invoker set search_path = ''
as $$
  with input as (select lower(trim(p_email)) as email)
  select (not exists (select 1 from public.allowed_signup_domains) and not exists (select 1 from public.whitelisted_emails))
    or exists (select 1 from public.whitelisted_emails w, input i where w.email = i.email)
    or exists (select 1 from public.allowed_signup_domains d, input i where d.domain = substring(i.email from '@([^@]+)$'))
    or exists (
      select 1 from public.user_profiles p, input i
      where p.user_id = encode(sha256(convert_to(i.email, 'UTF8')), 'hex') and p.is_superadmin
    )
  from input;
$$;

-- Everything one AI request needs: the chains of its purpose with their weights and steps, glossary terms that
-- may occur in the text (the app checks word boundaries), and the ten newest reference adaptations.
create function public.ai_generation_context(p_purpose text, p_text text)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'chains', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'weight', coalesce(m.weight, 0),
        'steps', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', s.id, 'position', s.position, 'kind', s.kind, 'model_id', s.model_id, 'model', lm.api_model_id,
            'effort', s.effort, 'max_tokens', s.max_tokens
          ) order by s.position), '[]'::jsonb)
          from public.prompt_chain_steps s join public.llm_models lm on lm.id = s.model_id
          where s.chain_id = c.id
        )
      ) order by c.id), '[]'::jsonb)
      from public.prompt_chains c left join public.prompt_chain_mix m on m.chain_id = c.id
      where c.purpose = p_purpose
    ),
    'terms', (
      select coalesce(jsonb_agg(jsonb_build_object('term', t.term, 'language', t.language, 'definition', t.definition, 'example', t.example)
        order by t.id), '[]'::jsonb)
      from (
        select * from public.terms where strpos(lower(coalesce(p_text, '')), lower(term)) > 0 order by id limit 50
      ) t
    ),
    'examples', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'source_language', e.source_language, 'en', e.body_en, 'es', e.body_es, 'zh', e.body_zh,
        'explanation', e.explanation, 'notes', e.notes
      ) order by e.created_at desc, e.id desc), '[]'::jsonb)
      from (select * from public.generation_examples order by created_at desc, id desc limit 10) e
    )
  );
$$;

-- Replace the mix weights in one statement. Every purpose keeps at least one chain with a weight above 0.
create function public.set_prompt_chain_mix(p_weights jsonb)
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
    group by c.purpose having coalesce(sum(m.weight), 0) = 0
  ) then
    raise exception 'Every purpose needs a chain with a weight above 0.' using errcode = 'check_violation';
  end if;
end;
$$;

-- Chains with their steps, mix weight, request counts, and how readers rated the versions each chain wrote.
-- A joke's versions belong to the chain of its latest successful adaptation request.
create function public.admin_prompt_chains()
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
  left join outcomes o on o.chain_id = c.id;
$$;

-- The newest AI requests with their chain, account, and token totals.
create function public.admin_generation_requests(p_limit int default 1000)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(item.request order by item.created_at desc, item.id desc), '[]'::jsonb)
  from (
    select r.created_at, r.id, jsonb_build_object(
      'id', r.id,
      'purpose', r.purpose,
      'source', r.source,
      'chain_id', r.chain_id,
      'chain_name', c.name,
      'user_id', r.user_id,
      'account_name', p.display_name,
      'account_email', p.email,
      'joke_id', r.joke_id,
      'input', r.input,
      'explanation', r.explanation,
      'locale', r.locale,
      'status', r.status,
      'error', r.error,
      'created_at', r.created_at,
      'completed_at', r.completed_at,
      'responses', coalesce(t.responses, 0),
      'input_tokens', coalesce(t.input_tokens, 0),
      'output_tokens', coalesce(t.output_tokens, 0)
    ) as request
    from public.generation_requests r
    left join public.prompt_chains c on c.id = r.chain_id
    left join public.user_profiles p on p.user_id = r.user_id
    left join lateral (
      select count(*)::int as responses, sum(l.input_tokens)::int as input_tokens, sum(l.output_tokens)::int as output_tokens
      from public.llm_responses l where l.request_id = r.id
    ) t on true
    order by r.created_at desc, r.id desc
    limit greatest(p_limit, 0)
  ) item;
$$;

-- The newest model calls without their prompts and answers, which the detail view loads one at a time.
create function public.admin_llm_responses(p_limit int default 1000)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(item.response order by item.created_at desc, item.id desc), '[]'::jsonb)
  from (
    select l.created_at, l.id, jsonb_build_object(
      'id', l.id,
      'request_id', l.request_id,
      'purpose', r.purpose,
      'source', r.source,
      'input', left(r.input, 300),
      'chain_name', c.name,
      'step_name', s.name,
      'step_position', s.position,
      'kind', l.kind,
      'model', l.model,
      'model_name', lm.name,
      'effort', l.effort,
      'status', l.status,
      'http_status', l.http_status,
      'stop_reason', l.stop_reason,
      'input_tokens', l.input_tokens,
      'output_tokens', l.output_tokens,
      'cache_read_input_tokens', l.cache_read_input_tokens,
      'cache_creation_input_tokens', l.cache_creation_input_tokens,
      'duration_ms', l.duration_ms,
      'error', l.error,
      'created_at', l.created_at
    ) as response
    from public.llm_responses l
    join public.generation_requests r on r.id = l.request_id
    left join public.prompt_chains c on c.id = r.chain_id
    left join public.prompt_chain_steps s on s.id = l.step_id
    left join public.llm_models lm on lm.id = l.model_id
    order by l.created_at desc, l.id desc
    limit greatest(p_limit, 0)
  ) item;
$$;

-- Every photo in the avatars bucket with the account that uses it, if any.
create function public.admin_images()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'path', o.name,
    'size', (o.metadata->>'size')::bigint,
    'content_type', o.metadata->>'mimetype',
    'created_at', o.created_at,
    'user_id', p.user_id,
    'name', p.display_name,
    'email', p.email,
    'in_use', coalesce(p.avatar_source = 'upload', false),
    'google_url', p.google_url
  ) order by o.created_at desc, o.name), '[]'::jsonb)
  from storage.objects o
  left join public.user_profiles p on p.avatar_path = o.name
  where o.bucket_id = 'avatars';
$$;

revoke all on function public.signup_allowed(text), public.ai_generation_context(text, text), public.set_prompt_chain_mix(jsonb),
  public.admin_prompt_chains(), public.admin_generation_requests(int), public.admin_llm_responses(int), public.admin_images()
  from public, anon, authenticated;
grant execute on function public.signup_allowed(text), public.ai_generation_context(text, text), public.set_prompt_chain_mix(jsonb),
  public.admin_prompt_chains(), public.admin_generation_requests(int), public.admin_llm_responses(int), public.admin_images()
  to service_role;

commit;
