-- Module 4 (autosearch + verification + autodownload) — see
-- for-claude/TZ_DJ_Party_2.0.pdf section 3.4. Additive to 0001_init.sql,
-- doesn't touch song_requests rows written by Stage 1.

-- New terminal/in-progress states for download_status. Postgres enums can't
-- have values removed, only added — 'pending' and 'manual_required' (from
-- 0001_init.sql) are superseded by 'searching'/'needs_review' below and are
-- simply never written by new code; no rows exist with the old values yet
-- (Stage 1 never populated this column), so nothing to backfill.
alter type download_status add value if not exists 'searching';
alter type download_status add value if not exists 'needs_review';

-- Human-readable explanation of the download_status outcome — e.g. "Hitmo:
-- сходство 0.82, длительность совпала" or "Ничего не найдено ни в одном
-- источнике". Freeform text rather than another enum: the reasons worth
-- surfacing to a moderator (which source, which check failed, what score)
-- don't reduce to a small fixed set the way the status itself does.
alter table song_requests add column if not exists download_match_reason text;

-- True whenever a moderator's attention is needed — both 'needs_review'
-- (found something, not confident) and 'failed' (found nothing) set this;
-- 'ready' and the in-progress states don't. A single boolean the admin UI
-- can key off without re-deriving "does this status need attention" in
-- every component that renders it.
alter table song_requests add column if not exists flagged_for_review boolean not null default false;

-- match_confidence (added in 0001_init.sql as a Stage 1 placeholder) was
-- never written by any code — download_status ('ready'/'needs_review'/
-- 'failed') plus download_match_reason's free text now cover that role.
-- Safe to drop: no live data depends on it.
alter table song_requests drop column if exists match_confidence;
drop type if exists match_confidence;
