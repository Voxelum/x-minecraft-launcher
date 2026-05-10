/**
 * JourneyManifest is the data structure that powers the docs-from-tests pipeline.
 *
 * Each spec accumulates `ShotRecord` entries via the shoot() helper and the
 * fixture flushes the result to:
 *
 *   e2e/artifacts/screenshots/<locale>/<journey-id>/manifest.json
 *
 * scripts/build-tutorial.ts reads every manifest and renders Markdown into
 * docs/tutorial/<journey-id>.md.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ARTIFACTS_ROOT = resolve(__dirname, '../artifacts/screenshots')

export interface ShotRecord {
  /** e.g. "01-open-dialog". Used as the file basename. */
  step: string
  /** Absolute path on disk to the captured PNG. */
  pngPath: string
  /** Path stored in manifest, relative to the journey directory. */
  relPath: string
  /** Imperative one-sentence caption. Markdown allowed. */
  caption: string
  /** Optional notes that appear under the screenshot in the docs. */
  detail?: string
  /** Captured viewport size. */
  viewport: { width: number; height: number }
}

export interface JourneyManifest {
  /** Slug derived from the test title, used as the journey-id. */
  id: string
  /** Original test path / title joined for human-readable headers. */
  journey: string
  /** Source spec file. */
  file: string
  locale: string
  shots: ShotRecord[]
  createdAt: string
}

export function newJourneyManifest(opts: {
  journey: string
  locale: string
  file: string
}): JourneyManifest {
  return {
    id: slugify(opts.journey),
    journey: opts.journey,
    file: opts.file,
    locale: opts.locale,
    shots: [],
    createdAt: new Date().toISOString(),
  }
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export function journeyDir(manifest: JourneyManifest): string {
  return join(ARTIFACTS_ROOT, manifest.locale, manifest.id)
}

export async function flushJourneyManifest(manifest: JourneyManifest): Promise<void> {
  if (manifest.shots.length === 0) return
  const dir = journeyDir(manifest)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
}
