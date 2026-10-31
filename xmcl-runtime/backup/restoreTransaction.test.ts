import { mkdtemp, mkdir, readFile, readdir, readlink, realpath, rename, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { RestoreRecoveryError, RestoreTransaction } from './restoreTransaction'
let root: string
beforeEach(async () => { root = await realpath(await mkdtemp(join(tmpdir(), 'xmcl-restore-tx-'))) })
afterEach(async () => { await rm(root, { force: true, recursive: true }) })
async function fixture(fault?: (point: string, index: number) => void) {
  const inputs = []
  for (let i = 0; i < 3; i++) {
    const live = join(root, `target-${i}`)
    await writeFile(live, `old-${i}`)
    inputs.push({ live, stage: async (candidate: string) => { await writeFile(candidate, `new-${i}`) } })
  }
  return RestoreTransaction.prepare(join(root, 'journals'), inputs, fault)
}
async function expectOld() { for (let i = 0; i < 3; i++) expect(await readFile(join(root, `target-${i}`), 'utf8')).toBe(`old-${i}`) }
for (const point of ['journal-before', 'journal-after', 'old-before', 'old-after', 'old-done', 'new-before', 'new-after', 'new-done']) {
  for (let index = 0; index < 3; index++) test(`${point} failure at target ${index} restores every original`, async () => {
    const tx = await fixture((p, i) => { if (p === point && i === index) throw new Error('injected disk failure') })
    let memory = 'old'
    await expect(tx.commit(async () => { memory = 'new' }, async () => { memory = 'old' })).rejects.toThrow('injected disk failure')
    await expectOld(); expect(memory).toBe('old')
    await RestoreTransaction.recover(join(root, 'journals')); await RestoreTransaction.recover(join(root, 'journals'))
    await expectOld()
  })
}
for (const point of ['publish-before', 'publish-after', 'committed-before']) test(`${point} failure undoes publication`, async () => {
  const tx = await fixture(p => { if (p === point) throw new Error('publish failure') })
  let memory = 'old'
  await expect(tx.commit(async () => { memory = 'new' }, async () => { memory = 'old' })).rejects.toThrow('publish failure')
  expect(memory).toBe('old'); await expectOld()
})
test('rollback failure retains unique originals and restart recovery is idempotent', async () => {
  const tx = await fixture((p, i) => { if (p === 'new-after' && i === 2 || p === 'rollback-before') throw new Error('disk offline') })
  await expect(tx.commit(async () => {}, async () => {})).rejects.toBeInstanceOf(RestoreRecoveryError)
  expect(await readFile(tx.journalPath, 'utf8')).toContain('rolling-back')
  for (let i = 0; i < 3; i++) expect(await readFile(join(root, (await readdir(root)).find(n => n.endsWith(`target-${i}.rollback`))!), 'utf8')).toBe(`old-${i}`)
  await RestoreTransaction.recover(join(root, 'journals')); await RestoreTransaction.recover(join(root, 'journals')); await expectOld()
})
test('successful multi-target commit removes rollback evidence only after commit', async () => {
  const tx = await fixture()
  await tx.commit(async () => {}, async () => {})
  for (let i = 0; i < 3; i++) expect(await readFile(join(root, `target-${i}`), 'utf8')).toBe(`new-${i}`)
  expect(await readdir(join(root, 'journals'))).toEqual([])
})
test('restart rolls back prepared transaction without touching original', async () => {
  await fixture(); await RestoreTransaction.recover(join(root, 'journals')); await expectOld()
})
test('external changes block recovery without deleting originals', async () => {
  const tx = await fixture((p, i) => { if (p === 'new-after' && i === 0 || p === 'rollback-before') throw new Error('stop') })
  await expect(tx.commit(async () => {}, async () => {})).rejects.toThrow()
  await writeFile(join(root, 'target-0'), 'external')
  await expect(RestoreTransaction.recover(join(root, 'journals'))).rejects.toBeInstanceOf(RestoreRecoveryError)
  expect(await readFile(tx.journalPath, 'utf8')).toContain('rolling-back')
})

// Simulate actual process interruption: perform persisted intent/rename steps
// without running the live catch/rollback path, then instantiate recovery afresh.
for (const point of ['old-before', 'old-after', 'new-before', 'new-after', 'new-done']) {
  for (let index = 0; index < 3; index++) test(`restart at ${point} target ${index} resolves rename intent by identities`, async () => {
    const tx = await fixture()
    const journal = JSON.parse(await readFile(tx.journalPath, 'utf8'))
    journal.phase = 'committing'
    for (let i = 0; i <= index; i++) {
      const target = journal.targets[i]
      journal.intent = `${i}:old`
      await writeFile(tx.journalPath, JSON.stringify(journal))
      if (i === index && point === 'old-before') break
      await rename(target.live, target.rollback)
      if (i === index && point === 'old-after') break
      journal.done = `${i}:old`; journal.intent = `${i}:new`
      await writeFile(tx.journalPath, JSON.stringify(journal))
      if (i === index && point === 'new-before') break
      await rename(target.candidate, target.live)
      if (i === index && point === 'new-after') break
      journal.done = `${i}:new`
      await writeFile(tx.journalPath, JSON.stringify(journal))
    }
    await RestoreTransaction.recover(join(root, 'journals'))
    await RestoreTransaction.recover(join(root, 'journals'))
    await expectOld()
    expect(await readdir(join(root, 'journals'))).toEqual([])
  })
}
for (const reason of ['AbortError: cancelled', 'ENOSPC: disk full']) test(`staging ${reason} leaves original bytes and removes partial candidates`, async () => {
  const live = join(root, 'target')
  await writeFile(live, 'ORIGINAL')
  await expect(RestoreTransaction.prepare(join(root, 'journals'), [{ live, stage: async path => {
    await writeFile(path, 'PARTIAL'); throw new Error(reason)
  } }])).rejects.toThrow(reason)
  expect(await readFile(live, 'utf8')).toBe('ORIGINAL')
  expect(await readdir(root)).toEqual(expect.arrayContaining(['journals', 'target']))
  expect((await readdir(root)).some(n => n.startsWith('.xmcl-restore'))).toBe(false)
})
test('new targets disappear on rollback; directory originals retain all binary bytes', async () => {
  const old = join(root, 'old')
  const added = join(root, 'added')
  await mkdir(old); await writeFile(join(old, 'binary'), Buffer.from([0, 1, 255, 0]))
  const tx = await RestoreTransaction.prepare(join(root, 'journals'), [
    { live: old, stage: async p => { await mkdir(p); await writeFile(join(p, 'binary'), 'NEW') } },
    { live: added, stage: async p => { await writeFile(p, 'ADDED') } },
  ], p => { if (p === 'publish-before') throw new Error('stop') })
  await expect(tx.commit(async () => {}, async () => {})).rejects.toThrow('stop')
  expect(await readFile(join(old, 'binary'))).toEqual(Buffer.from([0, 1, 255, 0]))
  await expect(readFile(added)).rejects.toMatchObject({ code: 'ENOENT' })
})

test('cleanup failure is visible after durable commit and interrupted recursive deletion resumes', async () => {
  const live = join(root, 'directory')
  await mkdir(live)
  await writeFile(join(live, 'a'), 'ORIGINAL A'); await writeFile(join(live, 'b'), 'ORIGINAL B')
  const tx = await RestoreTransaction.prepare(join(root, 'journals'), [{ live, stage: async p => { await mkdir(p); await writeFile(join(p, 'a'), 'RESTORED') } }], point => { if (point === 'cleanup-before') throw new Error('cleanup interrupted') })
  const result = await tx.commit(async () => {}, async () => {})
  expect(result).toEqual({ cleanupPending: true, recoveryPath: tx.journalPath })
  const journal = JSON.parse(await readFile(tx.journalPath, 'utf8'))
  expect(journal.phase).toBe('committed'); expect(journal.cleanupAuthorized).toBe(true)
  // rm already removed one child when the process lost power.
  await rm(join(journal.targets[0].rollback, 'a'))
  await RestoreTransaction.recover(join(root, 'journals'))
  await RestoreTransaction.recover(join(root, 'journals'))
  expect(await readFile(join(live, 'a'), 'utf8')).toBe('RESTORED')
  expect(await readdir(join(root, 'journals'))).toEqual([])
})

for (const corruption of ['phase', 'id', 'identity', 'target']) test(`corrupt ${corruption} journal blocks without guessing or deleting`, async () => {
  const tx = await fixture()
  const journal = JSON.parse(await readFile(tx.journalPath, 'utf8'))
  if (corruption === 'phase') journal.phase = 'unknown-state'
  if (corruption === 'id') journal.id = '00000000-0000-0000-0000-000000000000'
  if (corruption === 'identity') journal.targets[0].original.hash = 'invalid'
  if (corruption === 'target') journal.targets[0].candidate = join(root, 'unowned-candidate')
  await writeFile(tx.journalPath, JSON.stringify(journal))
  await expect(RestoreTransaction.recover(join(root, 'journals'))).rejects.toBeInstanceOf(RestoreRecoveryError)
  await expectOld()
  expect(await readFile(tx.journalPath, 'utf8')).toContain(corruption === 'phase' ? 'unknown-state' : 'targets')
})

test('moving a file between directories while preserving root inode is not the same identity', async () => {
  const live = join(root, 'directory')
  await mkdir(join(live, 'a'), { recursive: true })
  await writeFile(join(live, 'a', 'b'), 'B'); await writeFile(join(live, 'z'), 'Z')
  const tx = await RestoreTransaction.prepare(join(root, 'journals'), [{ live, stage: async p => { await mkdir(p); await writeFile(join(p, 'new'), 'NEW') } }])
  await rename(join(live, 'z'), join(live, 'a', 'z'))
  await expect(tx.commit(async () => {}, async () => {})).rejects.toBeInstanceOf(RestoreRecoveryError)
  expect(await readFile(join(live, 'a', 'z'), 'utf8')).toBe('Z')
  expect(await readFile(tx.journalPath, 'utf8')).toContain('rolling-back')
})


test('approved top-level cache links are hashed as link text, retained on commit and recovered without touching cache bytes', async () => {
  const live = join(root, 'instance')
  const libraries = join(root, 'libraries')
  const versions = join(root, 'versions')
  await mkdir(live); await mkdir(libraries); await mkdir(versions)
  const managedLinks = { libraries, versions }
  await writeFile(join(libraries, 'shared.jar'), 'SHARED LIBRARY')
  await writeFile(join(versions, 'version.json'), 'SHARED VERSION')
  for (const [name, path] of Object.entries(managedLinks)) await symlink(path, join(live, name), process.platform === 'win32' ? 'junction' : 'dir')
  await writeFile(join(live, 'config'), 'ORIGINAL')
  const tx = await RestoreTransaction.prepare(join(root, 'journals'), [{ live, managedLinks, stage: async p => {
    await mkdir(p)
    for (const [name, path] of Object.entries(managedLinks)) await symlink(path, join(p, name), process.platform === 'win32' ? 'junction' : 'dir')
    await writeFile(join(p, 'config'), 'RESTORED')
  } }], point => { if (point === 'new-after' || point === 'rollback-before') throw new Error('injected disk failure') })
  await expect(tx.commit(async () => {}, async () => {})).rejects.toBeInstanceOf(RestoreRecoveryError)
  // Shared cache changes are not changes to this transaction's instance tree.
  await writeFile(join(libraries, 'shared.jar'), 'CACHE UPDATED BY OWNER')
  await RestoreTransaction.recover(join(root, 'journals')); await RestoreTransaction.recover(join(root, 'journals'))
  expect(await readFile(join(live, 'config'), 'utf8')).toBe('ORIGINAL')
  for (const [name, path] of Object.entries(managedLinks)) expect(await readlink(join(live, name))).toBe(path)
  expect(await readFile(join(libraries, 'shared.jar'), 'utf8')).toBe('CACHE UPDATED BY OWNER')
  expect(await readFile(join(versions, 'version.json'), 'utf8')).toBe('SHARED VERSION')
})

for (const kind of ['unknown', 'nested', 'wrong-cache', 'linked-root']) test(`reject ${kind} links without altering their outside target`, async () => {
  const live = join(root, 'instance')
  const outside = join(root, 'outside')
  await mkdir(live); await mkdir(outside)
  await writeFile(join(outside, 'bytes'), 'UNTOUCHED')
  let inputLive = live
  if (kind === 'unknown') await symlink(outside, join(live, 'extra'), 'dir')
  if (kind === 'nested') { await mkdir(join(live, 'config')); await symlink(outside, join(live, 'config', 'libraries'), 'dir') }
  if (kind === 'wrong-cache') await symlink(outside, join(live, 'libraries'), 'dir')
  if (kind === 'linked-root') { inputLive = join(root, 'linked-root'); await symlink(live, inputLive, 'dir') }
  await expect(RestoreTransaction.prepare(join(root, 'journals'), [{ live: inputLive, managedLinks: { libraries: join(root, 'libraries') }, stage: async p => { await mkdir(p) } }])).rejects.toThrow()
  expect(await readFile(join(outside, 'bytes'), 'utf8')).toBe('UNTOUCHED')
})
