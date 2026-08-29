// Reverse proxy to eu.hitmoz.com, deployed as a Cloudflare Worker.
//
// WHY THIS EXISTS: Vercel's serverless function egress IPs get a hard 403
// straight from Hitmo's nginx (confirmed live — identical request, 200 from
// a residential/dev IP, 403 from Vercel prod, even with a full realistic
// browser header set). Cloudflare's edge IPs carry a huge share of normal
// internet traffic, so a site can't blanket-block them the way it can a
// single cloud provider's narrow IP ranges. This Worker forwards a
// deliberately curated set of headers from src/lib/download/sources/
// hitmo.ts's request through to eu.hitmoz.com — so the actual search/
// download requests both originate from Cloudflare's network AND carry
// nothing that identifies Vercel as the real client.
//
// That second half matters: an earlier version of this file built the
// forwarded headers via `new Headers(request.headers)` — a blanket clone of
// the INCOMING request's headers. Cloudflare's edge adds its own headers to
// every request that reaches a Worker (CF-Connecting-IP holding the real
// TCP client's IP chief among them — the same mechanism any site behind
// Cloudflare's proxy relies on to see its visitors' real IPs), so that
// blanket clone was forwarding Vercel's real IP straight to Hitmo in a
// header even though the TLS connection itself correctly came from
// Cloudflare. Confirmed as the likely cause: the proxy kept returning a
// real Hitmo 403 (not just our own secret check failing) well after any
// plausible rate-limit window had passed. Building the forwarded headers
// from an explicit allowlist — only the browser-mimicking headers hitmo.ts
// actually sets — is what actually stops that leak, not a denylist trying
// to name every Cloudflare-injected header (new ones could always be added
// on Cloudflare's side without this file changing to match).
//
// Locked to eu.hitmoz.com only (TARGET_ORIGIN below, not attacker-
// controlled) and gated by a shared secret so this can't be discovered and
// used as a free open proxy by anyone else — it only ever forwards to one
// fixed host either way, but the secret keeps random traffic (and Cloudflare
// Workers' free-tier request quota) off it.
//
// DEPLOY:
//   1. Cloudflare dashboard -> Workers & Pages -> Create -> paste this file.
//   2. Worker Settings -> Variables -> add PROXY_SECRET (any long random
//      string — must match HITMO_PROXY_SECRET in the Next.js app's env).
//   3. Note the assigned *.workers.dev URL -> that's HITMO_PROXY_URL.

const TARGET_ORIGIN = "https://eu.hitmoz.com";

// Only these ever get copied from the incoming request to the outgoing one
// — every one of them is a header hitmo.ts deliberately sets to mimic a
// real browser (see BROWSER_HEADERS there). Anything else on the incoming
// request (Cloudflare's own CF-*/X-Forwarded-* headers included) is
// dropped by simply never being in this list, rather than trusted by
// default and explicitly blocked.
const FORWARDED_HEADER_NAMES = [
  "user-agent",
  "accept",
  "accept-language",
  "referer",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-user",
  "upgrade-insecure-requests",
];

// Diagnostic logging, confirmed and gated off — the header-leak fix above
// was verified to actually strip Cloudflare's own identifying headers
// (CF-Connecting-IP etc.) from what gets forwarded, but Hitmo still blocks
// the request regardless (see src/lib/download/sources/index.ts for the
// full conclusion: a durable block on this colo's egress IPs, not a
// header problem). Flip back to true (redeploy) to re-check header
// forwarding if this is ever revisited.
const DEBUG = false;

export default {
  async fetch(request, env) {
    const providedSecret = request.headers.get("x-proxy-secret");

    if (!env.PROXY_SECRET || providedSecret !== env.PROXY_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }

    const incoming = new URL(request.url);
    const targetUrl = `${TARGET_ORIGIN}${incoming.pathname}${incoming.search}`;

    const forwardHeaders = new Headers();
    for (const name of FORWARDED_HEADER_NAMES) {
      const value = request.headers.get(name);
      if (value != null) forwardHeaders.set(name, value);
    }

    if (DEBUG) {
      console.log("[proxy-debug] headers", {
        incomingHeaderNames: [...request.headers.keys()],
        forwardedHeaderNames: [...forwardHeaders.keys()],
      });
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "follow",
    });

    // Streamed straight through — this also carries the eventual mp3
    // download response (multi-MB binary), not just the HTML search page.
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: upstreamResponse.headers,
    });
  },
};
