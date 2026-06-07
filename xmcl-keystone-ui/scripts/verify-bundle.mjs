#!/usr/bin/env node
// Postbuild check: catch the rolldown chunk-splitting regression where
// `init_*_esm_bundler` (or any cross-chunk `__esm` init helper) is referenced
// in one chunk but defined / imported nowhere — the symptom that broke 0.56.5
// with vite >= 8.0.14 (vitejs/vite#22583, vbenjs/vue-vben-admin#7955).
//
// Fails fast if any chunk in dist/assets references an `init_*` helper that
// has no `var init_*` / `function init_*` / `let init_*` / `const init_*`
// definition anywhere in the bundle.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const distDir = resolve(process.argv[2] || './dist/assets')

let files = []
try {
  files = readdirSync(distDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => join(distDir, f))
    .filter((f) => statSync(f).isFile())
} catch (e) {
  console.error(`verify-bundle: cannot read ${distDir}: ${e.message}`)
  process.exit(2)
}

if (files.length === 0) {
  console.error(`verify-bundle: no .js files found in ${distDir}`)
  process.exit(2)
}

const referenced = new Set()
const defined = new Set()
const refPattern = /\binit_[A-Za-z0-9_$]*_esm_bundler\b/g
const defPattern = /(?:var|let|const|function)\s+(init_[A-Za-z0-9_$]*_esm_bundler)\b/g
const refsByFile = new Map()

for (const file of files) {
  const src = readFileSync(file, 'utf8')

  for (const m of src.matchAll(defPattern)) defined.add(m[1])

  const localRefs = new Set()
  for (const m of src.matchAll(refPattern)) {
    referenced.add(m[0])
    localRefs.add(m[0])
  }
  if (localRefs.size) refsByFile.set(file, localRefs)
}

const missing = []
for (const ref of referenced) {
  if (!defined.has(ref)) missing.push(ref)
}

if (missing.length) {
  console.error('\nverify-bundle: FAIL — referenced ESM init helpers have no definition in dist:')
  for (const ref of missing) {
    const callers = []
    for (const [file, refs] of refsByFile) {
      if (refs.has(ref)) callers.push(file.replace(distDir, '').replace(/^[\\/]/, ''))
    }
    console.error(`  ${ref}  (referenced by: ${callers.join(', ')})`)
  }
  console.error('\nThis is the vitejs/vite#22583 rolldown regression.')
  console.error('Check vite.config.ts build.rolldownOptions and the vite version.')
  process.exit(1)
}

console.log(`verify-bundle: OK — ${defined.size} init helpers defined, ${referenced.size} referenced, 0 orphans across ${files.length} chunks.`)
