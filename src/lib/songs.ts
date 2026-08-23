export type SongStatus = "pending" | "approved" | "rejected" | "playing" | "played";

// Module 4's pipeline (src/lib/download/pipeline.ts) writes this column as:
// not_started (default, before approval) -> searching -> downloading ->
// ready | needs_review | failed. 'pending'/'manual_required' are Stage 1
// leftovers, superseded by 'searching'/'needs_review' — no code writes them
// anymore, kept in the type only because old enum values can't be dropped.
export type DownloadStatus =
  | "not_started"
  | "pending"
  | "searching"
  | "downloading"
  | "ready"
  | "needs_review"
  | "failed"
  | "manual_required";

export type SongRequest = {
  id: string;
  requester_name: string;
  song_title: string;
  artist_name: string;
  phone: string;
  status: SongStatus;
  duration_seconds: number | null;
  youtube_url: string | null;
  album_art_url: string | null;
  queue_position: number | null;
  download_status: DownloadStatus;
  download_source: string | null;
  download_match_reason: string | null;
  flagged_for_review: boolean;
  drive_file_id: string | null;
  drive_file_url: string | null;
  file_name: string | null;
  moderator_note: string | null;
  submitted_at: string;
  approved_at: string | null;
  started_playing_at: string | null;
  played_at: string | null;
};
