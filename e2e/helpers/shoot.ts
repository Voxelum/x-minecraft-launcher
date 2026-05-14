/**
 * shoot() — capture a screenshot AND record a tutorial caption.
 *
 * Usage in a spec:
 *
 *   await shoot(launcher, '01-home', {
 *     caption: 'Step 1. The launcher opens on the **Home** page.',
 *   })
 *
 * The screenshot lands at:
 *   e2e/artifacts/screenshots/<locale>/<journey-id>/01-home.png
 * and a `manifest.json` describing every shot in the journey is written
 * when the test fixture tears down.
 *
 * Captions follow a strict grammar to make tutorial generation deterministic:
 *   "Step N. Imperative sentence. Bold the **UI label** as it appears."
 *
 * shoot() never fails the test on its own — failed captures log a warning and
 * the spec continues. Visual regression is a SEPARATE concern handled by
 * Playwright's expect(page).toHaveScreenshot().
 */
import { Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { JourneyManifest, journeyDir } from './manifest'

export interface ShootOptions {
  /** Required imperative caption. */
  caption: string
  /** Optional supplementary detail rendered under the image in docs. */
  detail?: string
  /** Capture the full scrollable page instead of the viewport. */
  fullPage?: boolean
  /**
   * Locators to mask (covered by a solid block) before capture. Use for
   * volatile UI like timestamps and free-RAM readouts so the visual diff is
   * stable across runs.
   */
  masks?: import('@playwright/test').Locator[]
  /**
   * Wait for these locators to be visible before capturing. Helpful for
   * ensuring the docs always show the intended state.
   */
  waitFor?: import('@playwright/test').Locator[]
}

export interface ShootContext {
  main: Page
  manifest: JourneyManifest
}

export async function shoot(
  ctx: ShootContext,
  step: string,
  opts: ShootOptions,
): Promise<void> {
  const { main, manifest } = ctx
  const dir = journeyDir(manifest)
  await mkdir(dir, { recursive: true })

  for (const w of opts.waitFor ?? []) {
    await w.waitFor({ state: 'visible' }).catch(() => {})
  }
  // Let any layout / animation settle.
  await main.waitForLoadState('domcontentloaded').catch(() => {})
  await main.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(undefined))))

  const fileName = `${step}.png`
  const pngPath = join(dir, fileName)

  try {
    const buf = await main.screenshot({
      path: pngPath,
      fullPage: opts.fullPage ?? false,
      mask: opts.masks,
      animations: 'disabled',
      caret: 'hide',
    })
    const viewport = main.viewportSize() ?? { width: buf.length > 0 ? 0 : 0, height: 0 }
    manifest.shots.push({
      step,
      pngPath,
      relPath: fileName,
      caption: opts.caption,
      detail: opts.detail,
      viewport: viewport.width ? viewport : { width: 0, height: 0 },
    })
  } catch (err) {
    // Tutorial captures must not fail tests — log and continue.
    // eslint-disable-next-line no-console
    console.warn(`[shoot] failed to capture ${manifest.id}/${step}:`, err)
  }
}
