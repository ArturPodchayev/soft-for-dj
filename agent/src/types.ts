// The one shape every module in this agent passes around — deliberately its
// own type, not an import of the Next app's SongRequest (src/lib/songs.ts):
// this is exactly (and only) the columns the restricted `authenticated`
// grant (supabase/migrations/0003_local_agent_rls.sql) lets this agent
// SELECT. Importing the full SongRequest type would silently invite code
// here to reach for a field (e.g. `phone`) that a real query can never
// actually return.
export type AgentSong = {
  id: string;
  song_title: string;
  artist_name: string;
  duration_seconds: number | null;
  status: string;
  download_status: string;
};
