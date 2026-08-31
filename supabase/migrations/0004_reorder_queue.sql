-- Drag-and-drop reorder for the admin "Следующие" queue
-- (components/admin/UpNextQueue.tsx). Additive, doesn't touch 0001-0003.
--
-- Same atomicity reasoning as advance_playing_track() (0001_init.sql): a
-- moderator reordering N rows via read-then-write from the client would
-- leave a real, observable window with a half-reordered queue_position set
-- if a track got played/deleted mid-drag — one RPC call is one transaction,
-- so a concurrent reader only ever sees the pre- or post-reorder state, and
-- a rejected reorder never applies partially.
create or replace function reorder_queue(song_ids uuid[])
returns setof song_requests
language plpgsql
as $$
declare
  expected_count integer := coalesce(array_length(song_ids, 1), 0);
  updated_count integer;
begin
  -- An empty array is a valid (if unusual) "the up-next queue is now
  -- empty" reorder — nothing to update, nothing to reject.
  if expected_count = 0 then
    return;
  end if;

  -- Position 1..N in array order, but only for rows still in
  -- approved/playing — a track another moderator already played or
  -- rejected out from under this drag simply won't match here.
  update song_requests
  set queue_position = ordered.position
  from (
    select id, pos as position
    from unnest(song_ids) with ordinality as u(id, pos)
  ) as ordered
  where song_requests.id = ordered.id
    and song_requests.status in ('approved', 'playing');

  get diagnostics updated_count = row_count;

  -- Fewer rows updated than ids given means at least one id no longer
  -- matched an approved/playing row (played/deleted/duplicate id) —
  -- raising here rolls back the UPDATE above too (an unhandled exception
  -- aborts this function's whole transaction), so the caller never ends up
  -- with a partially-applied order. The API route (POST
  -- /api/admin/queue/reorder) turns this into a 409 for the client to
  -- resolve by refetching, not a silent partial success.
  if updated_count <> expected_count then
    raise exception 'reorder_queue: % of % ids matched an approved/playing row', updated_count, expected_count
      using errcode = 'P0001';
  end if;

  return query select * from song_requests where id = any(song_ids);
end;
$$;
