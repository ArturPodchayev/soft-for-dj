export type SongStatus = "pending" | "approved" | "rejected" | "playing" | "played";

export type DownloadStatus =
  | "not_started"
  | "pending"
  | "downloading"
  | "ready"
  | "failed"
  | "manual_required";

export type MatchConfidence = "confirmed" | "uncertain" | "not_found";

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
  match_confidence: MatchConfidence | null;
  drive_file_id: string | null;
  drive_file_url: string | null;
  file_name: string | null;
  moderator_note: string | null;
  submitted_at: string;
  approved_at: string | null;
  started_playing_at: string | null;
  played_at: string | null;
};
