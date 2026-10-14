begin;

-- The original humor collection and its caption votes were replaced by jokes, joke_adaptations, and adaptation_ratings.
drop function if exists public.caption_vote_summary(bigint, text);
drop table if exists public.caption_vote_duplicates;
drop table if exists public.caption_votes;
drop table if exists public.humor_entries;

commit;
