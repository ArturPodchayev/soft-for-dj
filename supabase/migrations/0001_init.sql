-- soft-for-dj: Stage 1 schema (song requests + atomic queue advance).
-- Ported from aut-dj-party's db/schema.sql (proven live at AUT) with
-- generic naming instead of an aut_-prefixed, single-venue schema, plus the
-- download-pipeline columns Stage 2 (autosearch/Google Drive) will use —
-- added now so Stage 2 is an additive migration, not a reshape of rows that
-- already exist from a live event.

create extension if not exists pgcrypto;

do $$ begin
  create type song_status as enum ('pending', 'approved', 'rejected', 'playing', 'played');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type download_status as enum ('not_started', 'pending', 'downloading', 'ready', 'failed', 'manual_required');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type match_confidence as enum ('confirmed', 'uncertain', 'not_found');
exception
  when duplicate_object then null;
end $$;

create table if not exists song_requests (
  id uuid primary key default gen_random_uuid(),
  requester_name text not null,
  song_title text not null,
  artist_name text not null,
  -- One active request per phone (mirrors aut_songs_phone_unique) — a plain
  -- UNIQUE constraint is enough since Postgres never treats NULL = NULL, so
  -- this doesn't block future non-phone submission paths from leaving it null.
  phone text not null,
  status song_status not null default 'pending',

  duration_seconds int,
  youtube_url text,
  album_art_url text,

  -- Manual ordering for the approved queue, independent of submitted_at —
  -- see lib/queue.ts's orderApprovedQueue for why this must be the ONLY
  -- place "queue order" is computed (a live aut-dj-party incident was
  -- exactly two different order-by implementations disagreeing).
  queue_position integer,

  -- Stage 2 (autosearch + Google Drive) fields — unused by Stage 1's admin
  -- flow, kept nullable/harmless until that module writes to them.
  download_status download_status not null default 'not_started',
  download_source text,
  match_confidence match_confidence,
  drive_file_id text,
  drive_file_url text,
  file_name text,
  moderator_note text,

  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  started_playing_at timestamptz,
  played_at timestamptz,

  constraint song_requests_phone_unique unique (phone)
);

create index if not exists song_requests_status_idx on song_requests (status);
create index if not exists song_requests_submitted_at_idx on song_requests (submitted_at);

alter table song_requests enable row level security;

-- Public submission form (/submit) inserts directly with the anon key, but
-- only a fresh pending row — every other transition (approve/reject/advance)
-- goes through /api/admin/* routes using the service-role key, which
-- bypasses RLS entirely.
drop policy if exists song_requests_public_insert on song_requests;
create policy song_requests_public_insert on song_requests
  for insert
  to anon
  with check (
    status = 'pending'
    and approved_at is null
    and played_at is null
  );

-- /display's Realtime subscription and its initial server-rendered read both
-- use the anon key, so both are bound by this policy — only ever surfaces
-- what's currently queued or playing, never the raw pending inbox (which
-- would leak other guests' names/phone numbers to anyone on /display).
drop policy if exists song_requests_public_select on song_requests;
create policy song_requests_public_select on song_requests
  for select
  to anon
  using (status in ('approved', 'playing'));

-- Required for the anon client to receive realtime postgres_changes events
-- at all — actual visibility is still filtered per-connection by the select
-- policy above, so a change to a still-pending row is never delivered.
do $$ begin
  alter publication supabase_realtime add table song_requests;
exception
  when duplicate_object then null;
end $$;

-- Atomically retires whatever's currently 'playing' (-> 'played') and, if
-- p_next_id is given, promotes that row to 'playing' in the SAME statement's
-- transaction. This is the fix for the exact live incident described in
-- for-claude/prompt_for_claude_code.md: two separate UPDATE calls from the
-- app left a real, observable window with zero 'playing' rows, which
-- /display's poll could land in and render an empty screen mid-handoff, not
-- because a track was ever actually missing. A single RPC call is one
-- PostgREST transaction, so a concurrent reader (or Realtime subscriber) can
-- only ever observe the pre- or post-advance state.
--
-- p_next_id is nullable because "advance" with nothing left in the queue
-- still needs to retire the current track without promoting anything after
-- it. Returns the newly-playing row (empty if p_next_id was null, or if it
-- lost a race to another moderator's click and is no longer 'approved' by
-- the time this runs).
create or replace function advance_playing_track(p_next_id uuid default null)
returns setof song_requests
language plpgsql
as $$
begin
  update song_requests
  set status = 'played', played_at = now()
  where status = 'playing';

  if p_next_id is not null then
    update song_requests
    set status = 'playing', started_playing_at = now()
    where id = p_next_id and status = 'approved';
  end if;

  return query select * from song_requests where status = 'playing';
end;
$$;
