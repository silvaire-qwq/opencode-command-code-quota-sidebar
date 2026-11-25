import { transformFileSync } from "@babel/core"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const transform = (source) =>
  transformFileSync(fileURLToPath(new URL(source, import.meta.url)), {
    babelrc: false,
    configFile: false,
    presets: [
      "@babel/preset-typescript",
      ["babel-preset-solid", { moduleName: "@opentui/solid", generate: "universal" }],
    ],
  })

// Bind the compiled plugin to the host's Solid/OpenTUI runtime. Resolving a
// local copy of either package gives the plugin its own reactive graph, so the
// slot paints once and never repaints (opencode#39986).
const runtime = (specifier) => `opentui:runtime-module:${encodeURIComponent(specifier)}`
const bind = (code) =>
  code
    .replaceAll('from "@opentui/solid"', `from "${runtime("@opentui/solid")}"`)
    .replaceAll('from "solid-js/store"', `from "${runtime("solid-js/store")}"`)
    .replaceAll('from "solid-js"', `from "${runtime("solid-js")}"`)

const tui = transform("../src/tui.tsx")
if (!tui?.code) throw new Error("Babel produced no output for src/tui.tsx")

// quota.ts has no JSX and imports nothing at runtime, so it ships as plain code
// with its relative import pointed at the emitted file name.
const quota = transform("../src/quota.ts")
if (!quota?.code) throw new Error("Babel produced no output for src/quota.ts")

mkdirSync(fileURLToPath(new URL("../dist", import.meta.url)), { recursive: true })
writeFileSync(new URL("../dist/quota.js", import.meta.url), quota.code)
writeFileSync(
  new URL("../dist/tui.js", import.meta.url),
  bind(tui.code).replaceAll('from "./quota"', 'from "./quota.js"'),
)
console.log("built dist/tui.js and dist/quota.js")
