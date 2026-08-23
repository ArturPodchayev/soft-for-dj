import * as cheerio from "cheerio";
import { fetchWithTimeout } from "@/lib/http";
import type { SourceAdapter, SourceCandidate } from "@/lib/download/types";

// eu. subdomain is required — bare hitmoz.com 403s automated requests
// (confirmed in for-claude/prompt_for_claude_code.md and again by hand
// while building this module).
const SEARCH_URL = "https://eu.hitmoz.com/search";
const ORIGIN = "https://eu.hitmoz.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function parseDuration(text: string): number | null {
  const match = /^(\d+):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

async function search(artist: string, title: string, timeoutMs: number): Promise<SourceCandidate[]> {
  const query = encodeURIComponent(`${artist} ${title}`);
  const res = await fetchWithTimeout(
    `${SEARCH_URL}?q=${query}`,
    { headers: { "User-Agent": USER_AGENT } },
    timeoutMs
  );

  if (!res.ok) {
    throw new Error(`hitmo search returned ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const candidates: SourceCandidate[] = [];

  $("ul.tracks__list > li.tracks__item").each((_, el) => {
    const item = $(el);
    const candidateTitle = item.find(".track__title").first().text().trim();
    const candidateArtist = item.find(".track__desc").first().text().trim();
    const durationText = item.find(".track__fulltime").first().text().trim();
    // The real full-track file — NOT data-musmeta's embedded `url`, which
    // is a ~30s preview cut (confirmed by comparing Content-Length: the
    // cuts/ URL is roughly 40% the size of the get/music/ one for the same
    // track). See src/lib/download/sources/index.ts's docblock for how
    // this was verified.
    const downloadHref = item.find("a.track__download-btn").first().attr("href");

    if (!candidateTitle || !candidateArtist || !downloadHref) return;

    candidates.push({
      title: candidateTitle,
      artist: candidateArtist,
      durationSeconds: parseDuration(durationText),
      downloadUrl: downloadHref.startsWith("http") ? downloadHref : `${ORIGIN}${downloadHref}`,
    });
  });

  return candidates;
}

export function createHitmoAdapter(timeoutMs: number): SourceAdapter {
  return {
    name: "hitmo",
    search: (artist, title) => search(artist, title, timeoutMs),
  };
}
