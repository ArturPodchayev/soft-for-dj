import { fetchWithTimeout } from "@/lib/http";

const REQUEST_TIMEOUT_MS = 8000;

// Normalizes messy guest input — typos/abbreviations or a Cyrillic phonetic
// spelling of a foreign title ("суперсоник" -> "Supersonic") — into a clean
// "Artist - Song Title" query used to search iTunes for cover art/duration.
// DeepSeek is only ever a search-query hint — it never supplies duration or
// any data that gets saved directly; iTunes is the source of truth for that.
// Falls back to the raw "Artist - Song" string on any failure (missing key,
// timeout, API error, odd response shape) so a DeepSeek outage never blocks
// approval.
export async function normalizeSongQuery(songTitle: string, artistName: string): Promise<string> {
  const rawQuery = `${artistName} - ${songTitle}`;
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return rawQuery;

  try {
    const res = await fetchWithTimeout(
      "https://api.deepseek.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0,
          max_tokens: 60,
          messages: [
            {
              role: "system",
              content:
                "The user is searching for a song. They typed a song title and artist name that may contain typos, abbreviations, or slang. It may also be written in Cyrillic as a phonetic transliteration of a foreign (usually English) title or artist name. If it looks like a phonetic transliteration, return the likely original Latin-script spelling as it appears on official platforms (Apple Music, iTunes, Spotify) — for example 'суперсоник' -> 'Supersonic'. If you do NOT confidently recognize this specific track or artist, return the input essentially as given (just cleaned up, in the 'Artist - Song Title' format) instead of guessing a different, similar-sounding track — it is much better to leave an unfamiliar title unnormalized than to confidently substitute the wrong song. Return ONLY the normalized query in the format 'Artist - Song Title', with no explanation or extra text.",
            },
            { role: "user", content: `Song title: ${songTitle}\nArtist: ${artistName}` },
          ],
        }),
      },
      REQUEST_TIMEOUT_MS
    );

    if (!res.ok) {
      console.error("DeepSeek normalization failed, falling back to raw query", { status: res.status });
      return rawQuery;
    }

    const data = await res.json();
    const normalized: string | undefined = data.choices?.[0]?.message?.content?.trim();
    return normalized || rawQuery;
  } catch (err) {
    console.error("DeepSeek normalization failed, falling back to raw query", {
      message: err instanceof Error ? err.message : String(err),
    });
    return rawQuery;
  }
}
