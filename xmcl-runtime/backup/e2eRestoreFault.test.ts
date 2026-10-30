import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getE2ERestoreFault } from './e2eRestoreFault'
let root: string
beforeEach(async () => { root = await realpath(await mkdtemp(join(tmpdir(), 'xmcl-e2e-restore-fault-'))); await mkdir(join(root, 'xmcl')) })
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { force: true, recursive: true }) })
function enable() { vi.stubEnv('XMCL_E2E', '1'); vi.stubEnv('XMCL_E2E_NO_LAUNCH', '1'); vi.stubEnv('XMCL_E2E_APP_DATA', root) }
test('no production access, requires all isolation flags and exact profile', async () => {
  const profile = join(root, 'xmcl')
  await writeFile(join(profile, '.xmcl-restore-fault.json'), 'invalid config would throw if read')
  vi.stubEnv('XMCL_E2E', ''); vi.stubEnv('XMCL_E2E_NO_LAUNCH', ''); vi.stubEnv('XMCL_E2E_APP_DATA', '')
  expect(await getE2ERestoreFault(profile)).toBeUndefined()
  vi.stubEnv('XMCL_E2E', '1'); expect(await getE2ERestoreFault(profile)).toBeUndefined()
  vi.stubEnv('XMCL_E2E_APP_DATA', root); expect(await getE2ERestoreFault(profile)).toBeUndefined()
  enable(); expect(await getE2ERestoreFault(join(root, 'normal-profile'))).toBeUndefined()
})
test('fixed profile fault triggers once and optional rollback failure preserves evidence', async () => {
  enable()
  await writeFile(join(root, 'xmcl', '.xmcl-restore-fault.json'), JSON.stringify({ point: 'new-after', target: 1, rollbackFailure: true }))
  const hook = (await getE2ERestoreFault(join(root, 'xmcl')))!
  await expect(hook('new-after', 0)).resolves.toBeUndefined()
  await expect(hook('new-after', 1)).rejects.toThrow('Injected restore failure')
  await expect(hook('new-after', 1)).resolves.toBeUndefined()
  await expect(hook('rollback-before', 0)).rejects.toThrow('rollback failure')
})
test('refuses arbitrary path/point config and fault-file symlink', async () => {
  enable()
  const file = join(root, 'xmcl', '.xmcl-restore-fault.json')
  for (const value of [{ point: 'whatever', target: 0 }, { point: 'new-after', target: 0, path: '/user-data' }]) {
    await writeFile(file, JSON.stringify(value))
    await expect(getE2ERestoreFault(join(root, 'xmcl'))).rejects.toThrow('Invalid')
  }
  await rm(file); await writeFile(join(root, 'outside'), '{}'); await symlink(join(root, 'outside'), file)
  await expect(getE2ERestoreFault(join(root, 'xmcl'))).rejects.toThrow('Invalid')
})

test('bounded staging pause is observable and abortable, with marker cleanup', async () => {
  enable()
  const profile = join(root, 'xmcl')
  const controller = new AbortController()
  await writeFile(join(profile, '.xmcl-restore-fault.json'), JSON.stringify({ point: 'staging-after', target: 0, pauseMs: 1500 }))
  const hook = (await getE2ERestoreFault(profile, controller.signal))!
  const paused = Promise.resolve(hook('staging-after', 0))
  const aborted = expect(paused).rejects.toThrow('aborted')
  for (let attempt = 0; attempt < 100; attempt++) {
    try { await readFile(join(profile, '.xmcl-restore-staging-ready')); break } catch (e) { if ((e as any).code !== 'ENOENT') throw e }
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  expect(JSON.parse(await readFile(join(profile, '.xmcl-restore-staging-ready'), 'utf8'))).toMatchObject({ target: 0 })
  controller.abort()
  await aborted
  await expect(readFile(join(profile, '.xmcl-restore-staging-ready'))).rejects.toMatchObject({ code: 'ENOENT' })
})
