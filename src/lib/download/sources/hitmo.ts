import * as cheerio from "cheerio";
import { fetchWithTimeout } from "@/lib/http";
import type { SourceAdapter, SourceCandidate } from "@/lib/download/types";

// eu. subdomain is required — bare hitmoz.com 403s automated requests
// (confirmed in for-claude/prompt_for_claude_code.md and again by hand
// while building this module).
const ORIGIN = "https://eu.hitmoz.com";
const SEARCH_URL = `${ORIGIN}/search`;

// Full realistic Chrome header set (checked against a real browser's
// Network tab) — kept even though it alone did NOT clear Vercel's 403 (see
// the proxy comment below), since it's still what a real browser sends and
// costs nothing to keep sending once routed through the Worker.
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: `${ORIGIN}/`,
  "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

// Vercel's serverless egress IPs get a straight 403 from Hitmo's nginx even
// with the full browser header set above (confirmed live) — an IP-range
// block, not a "doesn't look like a browser" block. HITMO_PROXY_URL, when
// set, points at a Cloudflare Worker (see cloudflare-worker/hitmo-proxy.js)
// that reverse-proxies to eu.hitmoz.com, so the request actually leaves
// from Cloudflare's network instead of Vercel's. Both the search request
// AND the eventual mp3 download (download() below) have to go through
// this — fixing only the search and leaving the download hitting
// eu.hitmoz.com directly would just move the 403 one step later.
// Unconfigured (e.g. local dev, where the direct request already works
// fine) falls straight through to the real origin.
function resolveFetchTarget(absoluteHitmoUrl: string): { url: string; headers: Record<string, string> } {
  const proxyUrl = process.env.HITMO_PROXY_URL;
  const proxySecret = process.env.HITMO_PROXY_SECRET;

  if (!proxyUrl) {
    return { url: absoluteHitmoUrl, headers: BROWSER_HEADERS };
  }

  const target = new URL(absoluteHitmoUrl);
  return {
    url: `${proxyUrl.replace(/\/$/, "")}${target.pathname}${target.search}`,
    headers: { ...BROWSER_HEADERS, "X-Proxy-Secret": proxySecret ?? "" },
  };
}

// TEMP DEBUG — diagnosing the "Flashing Lights / Kanye West" prod false
// negative — root-caused to Vercel's egress IP getting a straight 403 from
// Hitmo (see resolveFetchTarget's docblock) plus a self-inflicted Hitmo
// rate-limit from repeated live testing during that diagnosis. Fix
// confirmed working (proxy routing + retry both verified correct via this
// logging) — left in place, gated off, rather than ripped out, since a
// future "why is Hitmo failing again" session gets the exact same value
// from it. Flip back to true (redeploy) if that ever comes up again.
const DEBUG = false;

// Retries a transient-looking failure — confirmed live: the *identical*
// request through the *same* Cloudflare Worker flipped between 200 (real
// results) and 403 (a real Hitmo error page, not our own Worker's secret
// check — see the body-logging comment below) within minutes, most likely
// Hitmo's own anti-bot rate-limiting tripping under the burst of testing
// traffic this diagnosis generated, or a change of Cloudflare edge PoP
// between requests. NOT retried: a genuine timeout (the request is already
// slow — piling on more slow attempts just burns the pipeline's overall
// time budget, see the approve route's maxDuration) or a non-retryable
// status (a real 404/500 from Hitmo itself won't fix itself on retry).
const RETRYABLE_STATUSES = new Set([403, 429, 503]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, headers: Record<string, string>, timeoutMs: number): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetchWithTimeout(url, { headers }, timeoutMs);
    const willRetry = !res.ok && RETRYABLE_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS;

    if (DEBUG && !res.ok) {
      console.log("[hitmo-debug] non-ok response", { attempt, status: res.status, willRetry });
    }

    if (!willRetry) return res;
    await sleep(RETRY_DELAY_MS);
  }
  // Unreachable: the loop always returns by the MAX_ATTEMPTS-th iteration
  // (willRetry is forced false once attempt === MAX_ATTEMPTS).
  throw new Error("fetchWithRetry: unreachable");
}

function parseDuration(text: string): number | null {
  const match = /^(\d+):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

async function search(artist: string, title: string, timeoutMs: number): Promise<SourceCandidate[]> {
  const query = encodeURIComponent(`${artist} ${title}`);
  const { url: fetchUrl, headers } = resolveFetchTarget(`${SEARCH_URL}?q=${query}`);

  if (DEBUG) {
    const sentSecret = headers["X-Proxy-Secret"];
    console.log("[hitmo-debug] request", {
      url: fetchUrl,
      viaProxy: Boolean(process.env.HITMO_PROXY_URL),
      // length/last4 (not the full value) — enough to diff against the
      // Cloudflare Worker's own [proxy-debug] envLength/envLast4 log
      // (cloudflare-worker/hitmo-proxy.js) from this one Vercel log line,
      // without needing to also open Cloudflare's dashboard.
      sentSecretLength: sentSecret?.length,
      sentSecretLast4: sentSecret?.slice(-4),
      headers: { ...headers, "X-Proxy-Secret": sentSecret ? "<redacted>" : undefined },
    });
  }

  const res = await fetchWithRetry(fetchUrl, headers, timeoutMs);

  if (DEBUG) {
    console.log("[hitmo-debug] response headers", {
      status: res.status,
      contentType: res.headers.get("content-type"),
      server: res.headers.get("server"),
      cfRay: res.headers.get("cf-ray"),
      setCookie: res.headers.get("set-cookie") != null,
    });
  }

  // Read the body BEFORE the ok-check and log it either way — a non-ok
  // response's body is exactly what disambiguates "our own Worker's
  // Response("Forbidden", {status:403})" (body: literally "Forbidden", 9
  // bytes) from "the request reached eu.hitmoz.com and Hitmo itself
  // rejected it" (body: Hitmo's real HTML error page) — both can otherwise
  // look identical from headers alone once proxied (Cloudflare adds its
  // own server/cf-ray headers to both).
  const html = await res.text();

  if (DEBUG) {
    console.log("[hitmo-debug] response body", { length: html.length, first500: html.slice(0, 500) });
  }

  if (!res.ok) {
    throw new Error(`hitmo search returned ${res.status}`);
  }

  const $ = cheerio.load(html);

  const rawItems = $("ul.tracks__list > li.tracks__item");
  if (DEBUG) {
    console.log("[hitmo-debug] raw <li> matches", { count: rawItems.length });
  }

  const candidates: SourceCandidate[] = [];

  rawItems.each((_, el) => {
    const item = $(el);
    const candidateTitle = item.find(".track__title").first().text().trim();
    const candidateArtist = item.find(".track__desc").first().text().trim();
    const durationText = item.find(".track__fulltime").first().text().trim();
    // The real full-track file — NOT data-musmeta's embedded `url`, which
    // is a ~30s preview cut (confirmed by comparing Content-Length: the
    // cuts/ URL is roughly 40% the size of the get/music/ one for the same
    // track).
    const downloadHref = item.find("a.track__download-btn").first().attr("href");

    if (!candidateTitle || !candidateArtist || !downloadHref) {
      if (DEBUG) {
        console.log("[hitmo-debug] skipped raw item (missing title/artist/href)", {
          candidateTitle,
          candidateArtist,
          hasHref: Boolean(downloadHref),
        });
      }
      return;
    }

    candidates.push({
      title: candidateTitle,
      artist: candidateArtist,
      durationSeconds: parseDuration(durationText),
      downloadUrl: downloadHref.startsWith("http") ? downloadHref : `${ORIGIN}${downloadHref}`,
    });
  });

  if (DEBUG) {
    console.log("[hitmo-debug] parsed candidates", {
      count: candidates.length,
      candidates: candidates.map((c) => ({ title: c.title, artist: c.artist, durationSeconds: c.durationSeconds })),
    });
  }

  return candidates;
}

async function download(url: string, timeoutMs: number): Promise<Response> {
  const { url: fetchUrl, headers } = resolveFetchTarget(url);

  if (DEBUG) {
    console.log("[hitmo-debug] download request", { url: fetchUrl, viaProxy: Boolean(process.env.HITMO_PROXY_URL) });
  }

  return fetchWithRetry(fetchUrl, headers, timeoutMs);
}

export function createHitmoAdapter(timeoutMs: number): SourceAdapter {
  return {
    name: "hitmo",
    search: (artist, title) => search(artist, title, timeoutMs),
    download: (url) => download(url, timeoutMs),
  };
}
