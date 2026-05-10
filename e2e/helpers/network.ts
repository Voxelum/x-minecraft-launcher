/**
 * Network mock helper.
 *
 * Two strategies are supported:
 *
 *  1. Renderer-side `page.route()` — intercepts fetch() calls made by the
 *     keystone UI before they reach Electron's net stack. Use this for
 *     anything the renderer fetches directly (CurseForge, Modrinth, store
 *     project icons, etc).
 *
 *  2. Main-process intercept via `XMCL_E2E_MOCKS_FILE` — points the launcher
 *     at a JSON file describing URL patterns + canned responses. Used for
 *     services that fetch through the main process (Mojang manifest, Forge
 *     installer XML, MSAL token exchange).
 *
 * For the first PR most network journeys are kept as `test.skip` until the
 * main-process intercept is wired. Renderer-side helpers below are usable now.
 */
import { Page, Route } from '@playwright/test'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const FIXTURES_DIR = resolve(__dirname, '../fixtures/responses')

export interface MockRule {
  /** RegExp matched against the full URL. */
  url: RegExp
  /** Either an inline JSON payload or a fixture file basename under fixtures/responses/. */
  json?: unknown
  fixture?: string
  status?: number
  headers?: Record<string, string>
}

export async function applyMocks(page: Page, rules: MockRule[]): Promise<void> {
  for (const rule of rules) {
    await page.route(rule.url, async (route: Route) => {
      let body: string
      if (rule.fixture) {
        body = await readFile(join(FIXTURES_DIR, rule.fixture), 'utf8')
      } else {
        body = JSON.stringify(rule.json ?? {})
      }
      await route.fulfill({
        status: rule.status ?? 200,
        contentType: 'application/json',
        headers: rule.headers,
        body,
      })
    })
  }
}

/**
 * Convenience: stub all known marketplace + Mojang endpoints with empty
 * payloads so a journey doesn't accidentally hit the real internet.
 *
 * Specs are encouraged to layer more specific rules ON TOP of this baseline.
 */
export const SAFE_STUBS: MockRule[] = [
  { url: /launchermeta\.mojang\.com\/mc\/game\/version_manifest\.json/, json: { latest: { release: '1.20.4', snapshot: '24w14a' }, versions: [] } },
  { url: /api\.curseforge\.com\/v1\/.*/, json: { data: [], pagination: { index: 0, pageSize: 0, resultCount: 0, totalCount: 0 } } },
  { url: /api\.modrinth\.com\/v2\/.*/, json: { hits: [], offset: 0, limit: 0, total_hits: 0 } },
  { url: /meta\.fabricmc\.net\/.*/, json: [] },
  { url: /files\.minecraftforge\.net\/.*/, json: {}, headers: { 'content-type': 'text/html' } },
]
