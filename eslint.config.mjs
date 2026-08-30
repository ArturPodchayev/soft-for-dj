import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // cloudflare-worker/ is deployed separately (Cloudflare Worker runtime,
  // not part of this Next.js app's build) — its own module conventions
  // (a bare `export default { fetch(...) }`) aren't meant to satisfy this
  // config's Next.js-flavored rules. agent/ is likewise its own standalone
  // Node CLI project (own package.json/tsconfig, bundled+pkg'd separately —
  // see agent/README.md) with its own `npm run typecheck` inside that
  // directory; it only ever borrows source files FROM this app via a path
  // alias, this app's own lint/build never needs to reach into it.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "cloudflare-worker/**", "agent/**"]),
]);

export default eslintConfig;
