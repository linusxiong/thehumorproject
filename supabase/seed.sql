-- Run once in the Supabase SQL Editor. Only this demo table is created.
begin;

create table public.humor_entries (
  id bigint generated always as identity primary key,
  title text not null unique check (length(title) between 1 and 100),
  setup text not null check (length(setup) between 1 and 500),
  punchline text not null check (length(punchline) between 1 and 500),
  category text not null check (category in ('Everyday', 'Work', 'Code')),
  author text not null,
  likes integer not null default 0 check (likes >= 0),
  created_at timestamptz not null default now()
);

alter table public.humor_entries enable row level security;
revoke all on public.humor_entries from anon, authenticated;
grant select on public.humor_entries to anon, authenticated;
create policy "Public can read demo humor"
  on public.humor_entries for select to anon, authenticated using (true);

-- All content and engagement figures are fictional demo data.
-- Randomize authors, like counts, and timestamps at seed time.
insert into public.humor_entries (title, setup, punchline, category, author, likes, created_at)
select title, setup, punchline, category,
  (array['Alex', 'Jamie', 'Morgan', 'Sam', 'Riley'])[1 + floor(random() * 5)::int],
  20 + floor(random() * 480)::int,
  now() - random() * interval '14 days'
from (values
  ('An early night', 'I go to bed early every single night.', 'My phone just needs another three hours to wind down.', 'Everyday'),
  ('Coffee, technically', 'Does coffee really make me more productive?', 'Absolutely. I now have the energy to open a seventeenth tab.', 'Work'),
  ('A love letter in code', 'I named a variable after you.', 'Now every error message feels personal.', 'Code'),
  ('The Monday subscription', 'Monday feels like an ad I cannot skip.', 'And somehow I keep getting billed weekly.', 'Work'),
  ('A very consistent routine', 'I have stuck to my fitness plan for a whole month.', 'The planning part. The fitness part is still on the roadmap.', 'Everyday'),
  ('Perfectly stable software', 'I finally wrote code that never throws an error.', 'The secret was commenting out every line.', 'Code'),
  ('A productive meeting', 'We finally reached a unanimous decision in our meeting.', 'We need another meeting.', 'Work'),
  ('The fridge agreement', 'I put a DO NOT OPEN note on the fridge to help my diet.', 'Now I carefully remove the note before opening it. Rules matter.', 'Everyday'),
  ('Just a small change', 'The request was simple: move one button.', 'First, let me reconsider the architecture of the universe.', 'Code')
) as samples(title, setup, punchline, category);

commit;

select count(*) as seeded_entries from public.humor_entries;
