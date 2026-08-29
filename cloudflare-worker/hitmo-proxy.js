// Reverse proxy to eu.hitmoz.com, deployed as a Cloudflare Worker.
//
// WHY THIS EXISTS: Vercel's serverless function egress IPs get a hard 403
// straight from Hitmo's nginx (confirmed live — identical request, 200 from
// a residential/dev IP, 403 from Vercel prod, even with a full realistic
// browser header set). Cloudflare's edge IPs carry a huge share of normal
// internet traffic, so a site can't blanket-block them the way it can a
// single cloud provider's narrow IP ranges. This Worker just forwards
// whatever request src/lib/download/sources/hitmo.ts sends it — through to
// eu.hitmoz.com — so the actual search/download requests originate from
// Cloudflare's network instead of Vercel's.
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

export default {
  async fetch(request, env) {
    const providedSecret = request.headers.get("x-proxy-secret");

    // TEMP DEBUG — diagnosing a 403 that fires even with the correct secret
    // sent directly via curl, suspected to be a stray whitespace/newline
    // character in the PROXY_SECRET value as pasted into the Cloudflare
    // dashboard. Remove this console.log once resolved (Worker → Logs →
    // Begin log stream shows it live, no redeploy needed to view).
    console.log("[proxy-debug]", {
      providedLength: providedSecret?.length,
      providedLast4: providedSecret?.slice(-4),
      envLength: env.PROXY_SECRET?.length,
      envLast4: env.PROXY_SECRET?.slice(-4),
      match: providedSecret === env.PROXY_SECRET,
    });

    if (!env.PROXY_SECRET || providedSecret !== env.PROXY_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }

    const incoming = new URL(request.url);
    const targetUrl = `${TARGET_ORIGIN}${incoming.pathname}${incoming.search}`;

    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.delete("x-proxy-secret");
    forwardHeaders.delete("host");

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
