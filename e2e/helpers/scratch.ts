/**
 * One-call helpers for **scratch specs** — short, ad-hoc Playwright specs
 * intended for **visual verification** of a new UI feature. Designed to be
 * used by the GitHub Copilot agent (or a human contributor) in a single
 * file under `e2e/specs/scratch/<feature>.spec.ts`.
 *
 * Goals:
 *   - One import. One `test()`. One `snap()` per critical step.
 *   - No POM / fixture / manifest plumbing to learn.
 *   - Screenshots land at `e2e/artifacts/screenshots/en/<spec-id>/<step>.png`
 *     just like the canonical specs, so the same tooling renders them.
 *
 * Example (`e2e/specs/scratch/servers-tab.spec.ts`):
 *
 *   import { test, snap } from '../../helpers/scratch'
 *
 *   test('Servers tab — empty state', async ({ launcher, shell }) => {
 *     await shell.goto('/servers')
 *     await snap(launcher, '01-empty', 'Empty Servers tab.')
 *
 *     await launcher.main.getByTestId('add-server').click()
 *     await snap(launcher, '02-dialog', 'Add Server dialog opens.')
 *   })
 *
 * Run with:  pnpm test:e2e:scratch
 */
import type { Page } from '@playwright/test'
import { test as baseTest, expect } from '../fixtures/launcher'
import type { LauncherFixture } from '../fixtures/launcher'
import { AppShell } from './pom/AppShell'
import { shoot } from './shoot'

interface ScratchFixtures {
  shell: AppShell
}

/**
 * Drop-in replacement for Playwright's `test` that adds a ready-to-use
 * `shell` (POM) fixture and waits for the launcher to be past the bootstrap
 * wizard before the test body runs.
 */
export const test = baseTest.extend<ScratchFixtures>({
  shell: async ({ launcher }, use) => {
    const shell = new AppShell(launcher.main)
    await shell.waitReady()
    await use(shell)
  },
})

export { expect }

/**
 * Capture a captioned screenshot. The 1-line API the Copilot agent should
 * call after every visible UI change.
 *
 * @param launcher  the `launcher` fixture passed into the test
 * @param step      a short kebab-case label, e.g. `01-empty-state`
 * @param caption   a one-sentence description rendered in the tutorial
 */
export async function snap(
  launcher: LauncherFixture,
  step: string,
  caption: string,
): Promise<void> {
  await shoot(
    { main: launcher.main, manifest: launcher.manifest },
    step,
    { caption },
  )
}

/** Re-export `Page` so scratch specs can type their own helpers. */
export type { Page, LauncherFixture }
