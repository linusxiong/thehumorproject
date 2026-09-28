begin;

-- Preserve historical duplicate submissions before enforcing one vote per caption.
create table public.caption_vote_duplicates as
select id, caption_id, user_id, vote, created_at
from (
  select *, row_number() over (partition by caption_id, user_id order by id) as position
  from public.caption_votes
) votes where position > 1;
revoke all on public.caption_vote_duplicates from public, anon, authenticated;
delete from public.caption_votes where id in (select id from public.caption_vote_duplicates);

alter table public.caption_votes add constraint caption_votes_caption_user_key unique (caption_id, user_id);
drop index public.caption_votes_caption_id_idx;

create function public.caption_vote_summary(p_caption_id bigint, p_user_id text default null)
returns table(upvotes bigint, downvotes bigint, user_vote smallint)
language sql stable security invoker set search_path = ''
as $$
  select count(*) filter (where vote = 1), count(*) filter (where vote = -1),
    max(vote) filter (where user_id = p_user_id)
  from public.caption_votes where caption_id = p_caption_id;
$$;
revoke all on function public.caption_vote_summary(bigint, text) from public, anon, authenticated;
grant execute on function public.caption_vote_summary(bigint, text) to service_role;

commit;
