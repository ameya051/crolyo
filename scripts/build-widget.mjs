import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

const common = {
  bundle: true,
  minify: true,
  platform: "browser",
  target: ["es2018"],
  legalComments: "none",
};

await build({
  ...common,
  entryPoints: ["widget/loader.ts"],
  outfile: "public/widget.js",
  format: "iife",
});

await build({
  ...common,
  entryPoints: ["widget/chat.tsx"],
  outfile: "public/widget-chat.js",
  format: "esm",
  jsx: "automatic",
  jsxImportSource: "preact",
});

const runtimeBytes = gzipSync(readFileSync("public/widget-chat.js")).byteLength;
const limit = 100 * 1024;
if (runtimeBytes > limit) {
  throw new Error(`Widget runtime is ${runtimeBytes} bytes gzipped; limit is ${limit}.`);
}

console.log(`Widget runtime: ${runtimeBytes} bytes gzipped (limit ${limit}).`);
