-- Local download agent (agent/) — runs on the DJ's own laptop, on an
-- ordinary residential/venue Wi-Fi IP, to work around Hitmo's durable
-- datacenter-IP block that defeated the Vercel-hosted pipeline (see
-- src/lib/download/sources/index.ts's 2026-08-30 writeup). This migration
-- is additive to 0001/0002 — doesn't touch anything Stage 1/Module 4 wrote.
--
-- Credential design (confirmed with the user, see agent/README.md): NOT the
-- anon key with widened RLS — anon is publicly embedded in /submit's
-- browser bundle, so any RLS change on `anon` would let literally anyone
-- with devtools open flip download_status/flagged_for_review on any
-- approved row. Instead: one dedicated Supabase Auth user
-- (agent@internal.local, created once by hand in the Supabase dashboard —
-- see agent/README.md) signs in via the normal supabase-js
-- signInWithPassword() flow and gets a session under the standard
-- `authenticated` Postgres role. Nothing else in this app currently
-- authenticates as `authenticated` (the admin panel uses its own jose-signed
-- JWT cookie, not Supabase Auth — see src/lib/adminSession.ts), so handing
-- that role these grants doesn't loosen anything a real guest or moderator
-- session could reach. If a future feature ever adds real Supabase Auth
-- logins for something else, revisit this — those users would inherit the
-- same policies below.

-- Row-level: the agent only ever needs approved rows — this is the exact
-- same set both queries in agent/src/pipeline.ts's catch-up SELECT and its
-- Realtime subscription care about.
drop policy if exists song_requests_agent_select on song_requests;
create policy song_requests_agent_select on song_requests
  for select
  to authenticated
  using (status = 'approved');

drop policy if exists song_requests_agent_update on song_requests;
create policy song_requests_agent_update on song_requests
  for update
  to authenticated
  using (status = 'approved')
  with check (status = 'approved');

-- Column-level: RLS alone only restricts ROWS, not columns — a row-level
-- policy allowing UPDATE on an approved row would otherwise let the
-- `authenticated` role overwrite status/queue_position/phone/etc. too.
-- Postgres' column-level GRANT is the actual enforcement for "only the
-- download-pipeline columns" — the agent's own queries only ever touch
-- these columns anyway, this is defense in depth against a future bug in
-- agent code reaching further than intended.
--
-- SELECT deliberately excludes `phone` — the DJ's laptop has no reason to
-- ever see a guest's phone number, only enough to search/verify/write a
-- download (id, title, artist, duration, current statuses).
grant select (id, song_title, artist_name, duration_seconds, status, download_status)
  on song_requests to authenticated;

grant update (download_status, download_source, download_match_reason, flagged_for_review, file_name)
  on song_requests to authenticated;
