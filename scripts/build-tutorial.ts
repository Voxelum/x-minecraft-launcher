#!/usr/bin/env tsx
/**
 * scripts/build-tutorial.ts
 *
 * Compiles the per-journey manifests produced by the e2e suite into a
 * Markdown tutorial under docs/tutorial/.
 *
 * Inputs:
 *   e2e/artifacts/screenshots/<locale>/<journey-id>/manifest.json
 *   e2e/artifacts/screenshots/<locale>/<journey-id>/<step>.png
 *
 * Outputs:
 *   docs/tutorial/<locale>/<journey-id>.md
 *   docs/tutorial/<locale>/index.md
 *   docs/tutorial/<locale>/assets/<journey-id>/<step>.png   (copied)
 *
 * Run with: pnpm -C e2e tutorial
 */
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const SCREENSHOT_ROOT = resolve(REPO_ROOT, 'e2e/artifacts/screenshots')
const TUTORIAL_ROOT = resolve(REPO_ROOT, 'docs/tutorial')

interface ShotRecord {
  step: string
  pngPath: string
  relPath: string
  caption: string
  detail?: string
  viewport: { width: number; height: number }
}

interface JourneyManifest {
  id: string
  journey: string
  file: string
  locale: string
  shots: ShotRecord[]
  createdAt: string
}

async function exists(path: string): Promise<boolean> {
  try {
    const { stat } = await import('node:fs/promises')
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function listLocales(): Promise<string[]> {
  if (!(await exists(SCREENSHOT_ROOT))) return []
  const entries = await readdir(SCREENSHOT_ROOT, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name)
}

async function listJourneys(localeDir: string): Promise<string[]> {
  const entries = await readdir(localeDir, { withFileTypes: true })
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
}

function renderJourneyMarkdown(m: JourneyManifest, assetsRel: string): string {
  const lines: string[] = []
  lines.push(`# ${m.journey}`)
  lines.push('')
  lines.push(`> Generated automatically from \`${relative(REPO_ROOT, m.file).replace(/\\/g, '/')}\` on ${m.createdAt}.`)
  lines.push('')
  for (const shot of m.shots) {
    lines.push(`![${shot.step}](${assetsRel}/${shot.relPath})`)
    lines.push('')
    lines.push(shot.caption)
    if (shot.detail) {
      lines.push('')
      lines.push(`> ${shot.detail}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

function renderIndex(locale: string, manifests: JourneyManifest[]): string {
  const lines: string[] = []
  lines.push(`# XMCL Tutorial (${locale})`)
  lines.push('')
  lines.push('This tutorial is generated from the end-to-end test suite. Every step you see below is automatically exercised on every CI run, so the screenshots cannot drift from the real launcher.')
  lines.push('')
  lines.push('## Journeys')
  lines.push('')
  for (const m of manifests) {
    lines.push(`- [${m.journey}](./${m.id}.md)`)
  }
  lines.push('')
  return lines.join('\n')
}

async function main(): Promise<void> {
  const locales = await listLocales()
  if (locales.length === 0) {
    console.warn(`No screenshots found at ${SCREENSHOT_ROOT}. Run the e2e suite first: pnpm -C e2e test`)
    return
  }

  // Always rebuild from a clean slate for the locales we have.
  for (const locale of locales) {
    const out = join(TUTORIAL_ROOT, locale)
    await rm(out, { recursive: true, force: true })
    await mkdir(out, { recursive: true })
  }

  for (const locale of locales) {
    const localeDir = join(SCREENSHOT_ROOT, locale)
    const journeyIds = await listJourneys(localeDir)
    const manifests: JourneyManifest[] = []

    for (const id of journeyIds) {
      const manifestPath = join(localeDir, id, 'manifest.json')
      if (!(await exists(manifestPath))) continue
      const m = JSON.parse(await readFile(manifestPath, 'utf8')) as JourneyManifest
      manifests.push(m)

      const assetsDir = join(TUTORIAL_ROOT, locale, 'assets', id)
      await mkdir(assetsDir, { recursive: true })
      for (const shot of m.shots) {
        await copyFile(shot.pngPath, join(assetsDir, shot.relPath))
      }

      const md = renderJourneyMarkdown(m, `./assets/${id}`)
      await writeFile(join(TUTORIAL_ROOT, locale, `${id}.md`), md, 'utf8')
    }

    await writeFile(
      join(TUTORIAL_ROOT, locale, 'index.md'),
      renderIndex(locale, manifests),
      'utf8',
    )
    console.log(`Generated ${manifests.length} journey(s) for locale "${locale}" at ${join(TUTORIAL_ROOT, locale)}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
