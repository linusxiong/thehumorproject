-- Run with: supabase db query --linked --file scripts/check-votes.sql
-- Test rows are rolled back; no votes are retained.
begin;
do $$
declare
  caption bigint := (select id from public.humor_entries order by id limit 1);
  vote_id bigint;
begin
  assert caption is not null, 'Seed a story before checking votes';
  assert not (select relrowsecurity from pg_class where oid = 'public.caption_votes'::regclass), 'RLS must remain disabled';
  assert not has_table_privilege('anon', 'public.caption_votes', 'INSERT'), 'Anonymous clients must not insert';
  assert not has_table_privilege('authenticated', 'public.caption_votes', 'INSERT'), 'Supabase clients must not bypass Better Auth';
  assert not has_table_privilege('anon', 'public.caption_votes', 'SELECT'), 'Voter identities must not be public';
  assert has_table_privilege('service_role', 'public.caption_votes', 'INSERT'), 'The server must be able to insert';

  insert into public.caption_votes (caption_id, user_id, vote)
  values (caption, 'vote-schema-check', 1) returning id into vote_id;
  assert (select created_at is not null and vote = 1 from public.caption_votes where id = vote_id), 'An upvote must be stored with a timestamp';
  insert into public.caption_votes (caption_id, user_id, vote)
  values (caption, 'vote-schema-check-other', -1) returning id into vote_id;
  assert (select vote = -1 from public.caption_votes where id = vote_id), 'A downvote must be stored';

  begin
    insert into public.caption_votes (caption_id, user_id, vote) values (caption, 'vote-schema-check', -1);
    raise exception 'Duplicate vote accepted';
  exception when unique_violation then null;
  end;

  begin
    insert into public.caption_votes (caption_id, user_id, vote) values (caption, 'vote-schema-check', 0);
    raise exception 'Invalid vote accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.caption_votes (caption_id, user_id, vote) values (caption, '', 1);
    raise exception 'Empty user accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.caption_votes (caption_id, user_id, vote) values (-1, 'vote-schema-check', 1);
    raise exception 'Missing caption accepted';
  exception when foreign_key_violation then null;
  end;
end $$;
rollback;
select 'PASS: Vote inserts, constraints, table permissions, and disabled RLS; test rows rolled back.' as result;
