import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Files that intentionally credit the upstream project or its sponsors. */
const ATTRIBUTION_FILES = new Set(['views/SettingAbout.vue'])

const UPSTREAM_SUPPORT = [
  /discord\.gg\//,
  /xmcl\.app/,
  /reddit\.com\/r\/XMCL/i,
  /kook\.top/,
  /jq\.qq\.com/,
  /github\.com\/Voxelum\//i,
]

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) yield* sources(path)
    else if (/\.(vue|ts)$/.test(name) && !name.endsWith('.test.ts')) yield path
  }
}

describe('visible support destinations', () => {
  it('never point users at upstream XMCL communities, guides or issue trackers', () => {
    const offenders: string[] = []
    for (const file of sources(srcRoot)) {
      const rel = relative(srcRoot, file).replace(/\\/g, '/')
      if (ATTRIBUTION_FILES.has(rel)) continue
      const text = readFileSync(file, 'utf8')
      for (const pattern of UPSTREAM_SUPPORT) {
        if (pattern.test(text)) offenders.push(`${rel}: ${pattern}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
