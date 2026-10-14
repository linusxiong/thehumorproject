begin;

-- English jokes submitted by members; author_id is the verified-email digest, null marks a demo joke.
create table public.jokes (
  id bigint generated always as identity primary key,
  body text not null check (length(body) between 10 and 600),
  author_id text check (length(author_id) > 0),
  author_name text not null check (length(author_name) between 1 and 100),
  created_at timestamptz not null default now()
);
create index jokes_author_created_idx on public.jokes (author_id, created_at desc) where author_id is not null;
create index jokes_created_idx on public.jokes (created_at desc);

-- One culturally adapted version per audience, each with an English back-translation for comparison.
create table public.joke_adaptations (
  id bigint generated always as identity primary key,
  joke_id bigint not null references public.jokes (id) on delete cascade,
  audience text not null check (audience in ('en', 'es', 'zh')),
  body text not null check (length(body) between 1 and 2000),
  back_translation text not null check (length(back_translation) between 1 and 2000),
  punchline_core text not null check (length(punchline_core) between 1 and 500),
  notes text not null check (length(notes) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (joke_id, audience)
);

-- "Still funny?" ratings: one per member and version.
create table public.adaptation_ratings (
  adaptation_id bigint not null references public.joke_adaptations (id) on delete cascade,
  user_id text not null check (length(user_id) > 0),
  funny boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (adaptation_id, user_id)
);

-- Only the app server's secret key may read or change jokes and ratings.
alter table public.jokes enable row level security;
alter table public.joke_adaptations enable row level security;
alter table public.adaptation_ratings enable row level security;
revoke all on public.jokes, public.joke_adaptations, public.adaptation_ratings from public, anon, authenticated;
grant select, insert, delete on public.jokes, public.joke_adaptations to service_role;
grant select, insert, update, delete on public.adaptation_ratings to service_role;
grant usage on sequence public.jokes_id_seq, public.joke_adaptations_id_seq to service_role;

-- Newest jokes with every version, rating totals, and the given member's own rating.
-- Totals are always returned; the API hides them until the viewer has rated.
create function public.joke_feed(p_user_id text default null, p_joke_id bigint default null, p_limit int default 50)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select coalesce(jsonb_agg(feed.joke order by feed.created_at desc, feed.id desc), '[]'::jsonb)
  from (
    select j.id, j.created_at, jsonb_build_object(
      'id', j.id,
      'body', j.body,
      'author_name', j.author_name,
      'created_at', j.created_at,
      'is_demo', j.author_id is null,
      'adaptations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id,
          'audience', a.audience,
          'body', a.body,
          'back_translation', a.back_translation,
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
create function public.create_joke(p_author_id text, p_author_name text, p_body text, p_adaptations jsonb)
returns bigint
language plpgsql security invoker set search_path = ''
as $$
declare
  new_id bigint;
begin
  if jsonb_typeof(p_adaptations) is distinct from 'array' or jsonb_array_length(p_adaptations) = 0 then
    raise exception 'create_joke needs at least one adaptation';
  end if;
  insert into public.jokes (author_id, author_name, body)
  values (p_author_id, p_author_name, p_body)
  returning id into new_id;
  insert into public.joke_adaptations (joke_id, audience, body, back_translation, punchline_core, notes)
  select new_id, x.audience, x.body, x.back_translation, x.punchline_core, x.notes
  from jsonb_to_recordset(p_adaptations)
    as x(audience text, body text, back_translation text, punchline_core text, notes text);
  return new_id;
end;
$$;
revoke all on function public.create_joke(text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_joke(text, text, text, jsonb) to service_role;

-- Demo jokes so the feed is never empty.
with demo (body, created_at) as (
  values
    ('My boss told me to have a good day. So I went home.', now() - interval '4 hours'),
    ('I told my wife she was drawing her eyebrows too high. She looked surprised.', now() - interval '3 hours'),
    ('I''m reading a book about anti-gravity. It''s impossible to put down.', now() - interval '2 hours'),
    ('I asked the librarian if the library had any books on paranoia. She whispered, ''They''re right behind you.''', now() - interval '1 hour')
),
inserted as (
  insert into public.jokes (author_id, author_name, body, created_at)
  select null, 'Demo', body, created_at from demo
  returning id, body, created_at
)
insert into public.joke_adaptations (joke_id, audience, body, back_translation, punchline_core, notes, created_at)
select inserted.id, v.audience, v.body, v.back_translation, v.punchline_core, v.notes, inserted.created_at
from inserted
join (values
  -- Boss
  ('My boss told me to have a good day. So I went home.', 'en',
    'My boss told me to have a good day. So I went home.',
    'My boss told me to have a good day. So I went home.',
    'Literal reading of a polite farewell as permission to leave work.',
    'Kept almost verbatim because "have a good day" is a stock English pleasantry that already sets up the twist.'),
  ('My boss told me to have a good day. So I went home.', 'es',
    'Mi jefe me dijo: «Que tengas un buen día». Así que me fui a mi casa.',
    'My boss told me: "Have a good day." So I went home.',
    'Literal reading of the boss''s routine well-wish as permission to skip work, implying a good day is one spent away from the office.',
    '"Que tengas un buen día" is the everyday Spanish equivalent, so only the wording changed and the punchline is untouched.'),
  ('My boss told me to have a good day. So I went home.', 'zh',
    '早上老板拍拍我的肩膀说：“今天要过得开心点啊！”于是我转身就回家了。',
    'In the morning my boss patted my shoulder and said, "Make sure you have a happy day today!" So I turned around and went home.',
    'Obeying the boss''s cheerful wish literally by going home, implying a happy day is a day off work.',
    'A stiff "祝你今天愉快" sounds unnatural from a Chinese boss, so it became a casual morning pat on the shoulder, which makes the instant exit read as dutiful obedience.'),
  -- Eyebrows
  ('I told my wife she was drawing her eyebrows too high. She looked surprised.', 'en',
    'I told my wife she was drawing her eyebrows too high. She looked surprised.',
    'I told my wife she was drawing her eyebrows too high. She looked surprised.',
    'Double meaning of "looked surprised": her reaction versus the permanent look of raised eyebrows.',
    'Unchanged, since the English original already lands cleanly across English-speaking audiences.'),
  ('I told my wife she was drawing her eyebrows too high. She looked surprised.', 'es',
    'Le dije a mi esposa que se estaba pintando las cejas muy arriba. Parecía sorprendida.',
    'I told my wife she was painting her eyebrows too high up. She seemed surprised.',
    'Double meaning of "parecía sorprendida": her reaction versus the permanently surprised look of high eyebrows.',
    'Used "pintarse las cejas", the natural Spanish phrase for doing eyebrows, and "parecía" to keep the reaction-or-appearance ambiguity.'),
  ('I told my wife she was drawing her eyebrows too high. She looked surprised.', 'zh',
    '我跟老婆说：“你眉毛画得太高了。”她看起来特别惊讶。',
    'I told my wife, "You drew your eyebrows too high." She looked especially surprised.',
    'Double meaning of "看起来特别惊讶": her reaction versus the permanently astonished face that high-drawn eyebrows create.',
    '画眉毛 is everyday Chinese, and "看起来" keeps the same ambiguity between seeming surprised and looking surprised, so the punchline carries over directly.'),
  -- Anti-gravity
  ('I''m reading a book about anti-gravity. It''s impossible to put down.', 'en',
    'I''m reading a book about anti-gravity. It''s impossible to put down.',
    'I''m reading a book about anti-gravity. It''s impossible to put down.',
    'Pun on "impossible to put down": a gripping book versus a book that physically won''t stay down.',
    'Unchanged, because the "can''t put it down" idiom is universal in English.'),
  ('I''m reading a book about anti-gravity. It''s impossible to put down.', 'es',
    'Estoy leyendo un libro sobre la antigravedad. No lo puedo soltar.',
    'I''m reading a book about anti-gravity. I can''t let go of it.',
    'Pun on "no lo puedo soltar": a book too gripping to stop reading versus one that would float away if released.',
    '"No lo puedo soltar" is the natural Spanish idiom for a page-turner and keeps the physical double meaning.'),
  ('I''m reading a book about anti-gravity. It''s impossible to put down.', 'zh',
    '我最近在看一本讲反重力的书，简直爱不释手——一松手它就飘走了。',
    'Lately I''ve been reading a book about anti-gravity. I simply can''t bear to let go of it — the moment I let go, it floats away.',
    'Literalizing the idiom 爱不释手 ("love it too much to let go"): you can''t let go because the book would float away.',
    'Chinese has no "put down" pun, so the idiom 爱不释手 is taken literally, keeping the same gripping-book versus floating-book twist.'),
  -- Paranoia
  ('I asked the librarian if the library had any books on paranoia. She whispered, ''They''re right behind you.''', 'en',
    'I asked the librarian if the library had any books on paranoia. She whispered, "They''re right behind you."',
    'I asked the librarian if the library had any books on paranoia. She whispered, "They''re right behind you."',
    '"They''re right behind you" is both shelf directions and the classic paranoid fear of being followed.',
    'Unchanged apart from punctuation, since the whispered library setting already works throughout the English-speaking world.'),
  ('I asked the librarian if the library had any books on paranoia. She whispered, ''They''re right behind you.''', 'es',
    'Le pregunté a la bibliotecaria si tenían libros sobre la paranoia. Me susurró: «Están justo detrás de ti».',
    'I asked the librarian if they had any books on paranoia. She whispered to me: "They''re right behind you."',
    '"Están justo detrás de ti" is both shelf directions and the paranoid fear that "they" are following you.',
    'Spanish drops the subject, so "están" naturally reads as either the books or some unnamed "they", preserving the double meaning.'),
  ('I asked the librarian if the library had any books on paranoia. She whispered, ''They''re right behind you.''', 'zh',
    '我问图书管理员有没有关于被害妄想症的书。她压低声音说：“它们……就在你身后。”',
    'I asked the librarian whether there were any books about persecutory delusions. She lowered her voice and said, "They... are right behind you."',
    'The whispered "就在你身后" is both shelf directions and exactly the fear a paranoid person has of being followed.',
    '被害妄想症 is the everyday Chinese term for paranoia, and the lowered voice plus a dramatic pause make the directions sound like a warning.')
) as v (original, audience, body, back_translation, punchline_core, notes)
  on v.original = inserted.body;

commit;
