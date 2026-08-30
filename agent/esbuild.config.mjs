import { build } from "esbuild";

// Bundles the agent (plus the shared @/lib/download/* modules it imports
// from ../src) into one CJS file. Bundling — not just transpiling — matters
// here for two reasons: pkg snapshots whatever this file requires at build
// time, so anything left as an external runtime `require` of a bare
// package name would be invisible to it; and it's what lets a pure-ESM
// dependency (music-metadata, since v8) get pulled in cleanly even though
// the output format is CJS — esbuild rewrites its import/export syntax
// into the bundle at build time, it isn't require()'d as a separate
// package at runtime the way plain Node interop would need.
await build({
  entryPoints: ["src/main.ts"],
  outfile: "dist/bundle.cjs",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  tsconfig: "./tsconfig.json",
  logLevel: "info",
});
