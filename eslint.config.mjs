import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // cloudflare-worker/ is deployed separately (Cloudflare Worker runtime,
  // not part of this Next.js app's build) — its own module conventions
  // (a bare `export default { fetch(...) }`) aren't meant to satisfy this
  // config's Next.js-flavored rules.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "cloudflare-worker/**"]),
]);

export default eslintConfig;
