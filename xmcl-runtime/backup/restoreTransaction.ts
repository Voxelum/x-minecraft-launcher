/** Recoverable rename transaction. Not an atomic transaction across filesystems.
 * Candidates and retained originals are siblings of their live target. The caller
 * must hold the persistence/launch maintenance lock until publication completes.
 */
import { createHash, randomUUID } from 'crypto'
import { lstat, mkdir, open, readdir, readFile, rename, rm } from 'fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'path'
import { readManagedRestoreLink, validateManagedRestoreLinks, type ManagedRestoreLinks } from './managedLinks'

type Identity = { dev: number; ino: number; hash: string }
type Target = { live: string; candidate: string; rollback: string; original?: Identity; replacement?: Identity; managedLinks?: ManagedRestoreLinks }
type Journal = { version: 1; id: string; root: string; phase: 'staging' | 'prepared' | 'committing' | 'publishing' | 'committed' | 'rolling-back' | 'rolled-back'; targets: Target[]; cleanupAuthorized?: boolean; intent?: string; done?: string }
export type RestoreFault = (point: string, index: number) => void | Promise<void>
export class RestoreRecoveryError extends Error {
  constructor(message: string, readonly recoveryPath: string, readonly cause?: unknown) { super(`${message}; recoveryPath=${recoveryPath}`); this.name = 'RestoreRecoveryError' }
}
async function present(path: string) {
  try { return await lstat(path) } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw e }
}
async function assertAncestors(path: string) {
  let parent = dirname(resolve(path))
  while (true) {
    const st = await present(parent)
    if (st && (!st.isDirectory() || st.isSymbolicLink())) throw new Error(`Unsafe restore ancestor: ${parent}`)
    const next = dirname(parent)
    if (next === parent) break
    parent = next
  }
}
async function identity(path: string, managedLinks?: ManagedRestoreLinks): Promise<Identity> {
  const st = await lstat(path)
  const hash = createHash('sha256')
  async function visit(p: string) {
    const s = await lstat(p)
    if (s.isSymbolicLink()) {
      const text = await readManagedRestoreLink(path, p, managedLinks)
      hash.update(`managed-link\0${Buffer.byteLength(text)}\0${text}\0`)
      return
    }
    if (!s.isDirectory() && !s.isFile()) throw new Error(`Unsafe restore target: ${p}`)
    hash.update(s.isDirectory() ? 'directory\0' : 'file\0')
    if (s.isDirectory()) {
      for (const name of (await readdir(p)).sort()) { hash.update(`${name}\0`); await visit(join(p, name)) }
      hash.update('directory-end\0')
    } else {
      hash.update(`${s.size}\0`)
      const handle = await open(p, 'r')
      try { for await (const chunk of handle.createReadStream({ autoClose: false })) hash.update(chunk) } finally { await handle.close() }
    }
  }
  await visit(path)
  return { dev: st.dev, ino: st.ino, hash: hash.digest('hex') }
}
async function matches(path: string, expected?: Identity, managedLinks?: ManagedRestoreLinks) {
  if (!expected || !await present(path)) return false
  const actual = await identity(path, managedLinks)
  return actual.dev === expected.dev && actual.ino === expected.ino && actual.hash === expected.hash
}
async function syncTree(path: string, managedLinks?: ManagedRestoreLinks, root = path): Promise<void> {
  const s = await lstat(path)
  if (s.isSymbolicLink()) { await readManagedRestoreLink(root, path, managedLinks); return }
  if (s.isDirectory()) {
    for (const name of await readdir(path)) await syncTree(join(path, name), managedLinks, root)
    await syncRestoreDirectory(path)
  } else {
    const handle = await open(path, 'r')
    try { await handle.sync() } finally { await handle.close() }
  }
}
export async function syncRestoreDirectory(path: string) {
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(path, 'r')
    await handle.sync()
  } catch (e) {
    // Windows cannot open directories for fsync. Other filesystems may expose
    // the directory but reject syncing it. Never swallow unrelated I/O errors.
    const code = (e as NodeJS.ErrnoException).code || ''
    if (!['EINVAL', 'ENOTSUP'].includes(code) && !(process.platform === 'win32' && ['EBADF', 'EPERM', 'EISDIR', 'EACCES'].includes(code))) throw e
  } finally { await handle?.close() }
}
async function durableRename(from: string, to: string) { await rename(from, to); await syncRestoreDirectory(dirname(to)) }
async function save(path: string, journal: Journal) {
  const temp = `${path}.next`
  const handle = await open(temp, 'w', 0o600)
  try { await handle.writeFile(JSON.stringify(journal)); await handle.sync() } finally { await handle.close() }
  await durableRename(temp, path)
}
function validate(j: Journal, root: string) {
  if (!['staging', 'prepared', 'committing', 'publishing', 'committed', 'rolling-back', 'rolled-back'].includes(j.phase) || j.version !== 1 || j.root !== resolve(root) || !/^[a-f0-9-]{36}$/.test(j.id) || !Array.isArray(j.targets)) throw new Error('Invalid restore journal')
  const paths = new Set<string>()
  for (const t of j.targets) {
    validateManagedRestoreLinks(t.managedLinks)
    if (!isAbsolute(t.live) || t.live !== resolve(t.live) || t.candidate !== join(dirname(t.live), `.xmcl-restore-${j.id}-${basename(t.live)}.candidate`) || t.rollback !== join(dirname(t.live), `.xmcl-restore-${j.id}-${basename(t.live)}.rollback`) || (!['staging', 'rolling-back', 'rolled-back'].includes(j.phase) && !t.replacement?.hash)) throw new Error('Invalid restore journal target')
    for (const identity of [t.original, t.replacement]) if (identity && (!Number.isFinite(identity.dev) || !Number.isFinite(identity.ino) || !/^[a-f0-9]{64}$/.test(identity.hash))) throw new Error('Invalid restore target identity')
    for (const p of [t.live, t.candidate, t.rollback]) { if (paths.has(p)) throw new Error('Duplicate restore target'); paths.add(p) }
  }
  if (j.cleanupAuthorized !== undefined && (typeof j.cleanupAuthorized !== 'boolean' || !['committed', 'rolled-back'].includes(j.phase))) throw new Error('Invalid restore cleanup authorization')
  for (const a of j.targets) for (const b of j.targets) {
    if (a === b) continue
    const rel = relative(a.live, b.live)
    if (!rel || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))) throw new Error('Nested restore targets')
  }
}
export class RestoreTransaction {
  private constructor(readonly journalPath: string, private journal: Journal, private fault?: RestoreFault) {}
  static async prepare(root: string, inputs: { live: string; managedLinks?: ManagedRestoreLinks; stage: (candidate: string) => Promise<void> }[], fault?: RestoreFault) {
    root = resolve(root)
    await assertAncestors(join(root, 'journal'))
    await mkdir(root, { recursive: true })
    const id = randomUUID()
    const journal: Journal = { version: 1, id, root, phase: 'staging', targets: [] }
    const tx = new RestoreTransaction(join(root, `${id}.json`), journal, fault)
    await save(tx.journalPath, journal)
    try {
      for (const input of inputs) {
        const live = resolve(input.live)
        await assertAncestors(live)
        await mkdir(dirname(live), { recursive: true })
        const candidate = join(dirname(live), `.xmcl-restore-${id}-${basename(live)}.candidate`)
        const rollback = join(dirname(live), `.xmcl-restore-${id}-${basename(live)}.rollback`)
        validateManagedRestoreLinks(input.managedLinks)
        const original = await present(live) ? await identity(live, input.managedLinks) : undefined
        const target: Target = { live, candidate, rollback, original, managedLinks: input.managedLinks }
        journal.targets.push(target)
        // Reject duplicate/nested targets before staging or touching any live data.
        validate(journal, root)
        await save(tx.journalPath, journal)
        await fault?.('staging-before', journal.targets.length - 1)
        await input.stage(candidate)
        await fault?.('staging-after', journal.targets.length - 1)
        target.replacement = await identity(candidate, target.managedLinks)
        await syncTree(candidate, target.managedLinks)
        await save(tx.journalPath, journal)
      }
      journal.phase = 'prepared'
      validate(journal, root)
      await save(tx.journalPath, journal)
      await fault?.('prepared', -1)
      return tx
    } catch (e) {
      // Live targets have not changed. Retain the journal for recovery if cleanup
      // itself cannot finish (ENOSPC, permissions, unplugged volume).
      try { await tx.finishStaging(); await tx.rollback(); await tx.cleanup() } catch (recoveryError) { throw new RestoreRecoveryError('Restore staging failed', tx.journalPath, { error: e, recoveryError }) }
      throw e
    }
  }
  async commit(publish: () => Promise<void>, undoPublish: () => Promise<void>) {
    const j = this.journal
    try {
      j.phase = 'committing'; await save(this.journalPath, j)
      for (let i = 0; i < j.targets.length; i++) {
        const t = j.targets[i]
        await assertAncestors(t.live)
        await this.fault?.('journal-before', i)
        if (t.original ? !await matches(t.live, t.original, t.managedLinks) : !!await present(t.live)) throw new Error(`Restore target changed: ${t.live}`)
        if (!await matches(t.candidate, t.replacement, t.managedLinks)) throw new Error(`Restore candidate changed: ${t.candidate}`)
        for (const step of ['old', 'new'] as const) {
          j.intent = `${i}:${step}`; await save(this.journalPath, j); await this.fault?.('journal-after', i); await this.fault?.(`${step}-before`, i)
          if (step === 'old') { if (t.original) await durableRename(t.live, t.rollback) } else { await durableRename(t.candidate, t.live) }
          await this.fault?.(`${step}-after`, i)
          j.done = j.intent; await save(this.journalPath, j); await this.fault?.(`${step}-done`, i)
        }
      }
      j.phase = 'publishing'; await save(this.journalPath, j); await this.fault?.('publish-before', -1)
      await publish(); await this.fault?.('publish-after', -1)
      j.phase = 'committed'; await this.fault?.('committed-before', -1); await save(this.journalPath, j)
    } catch (e) {
      try { await this.rollback(); await undoPublish(); await this.cleanup() } catch (rollbackError) { throw new RestoreRecoveryError('Restore failed and needs recovery', this.journalPath, { error: e, rollbackError }) }
      throw e
    }
    // Cleanup failure cannot turn a durable commit into an attempted rollback.
    try {
      await this.cleanup()
      return { cleanupPending: false as const }
    } catch {
      return { cleanupPending: true as const, recoveryPath: this.journalPath }
    }
  }
  private async finishStaging() {
    if (this.journal.phase !== 'staging') return
    for (const t of this.journal.targets) {
      if (t.original ? !await matches(t.live, t.original, t.managedLinks) : !!await present(t.live)) throw new Error(`Target changed during staging: ${t.live}`)
      if (await present(t.rollback)) throw new Error(`Unexpected rollback during staging: ${t.rollback}`)
      if (!t.replacement && await present(t.candidate)) t.replacement = await identity(t.candidate, t.managedLinks)
    }
  }
  private async rollback() {
    const j = this.journal
    j.phase = 'rolling-back'; await save(this.journalPath, j)
    for (let i = j.targets.length - 1; i >= 0; i--) {
      const t = j.targets[i]
      await assertAncestors(t.live)
      await this.fault?.('rollback-before', i)
      if (await present(t.rollback)) {
        if (!await matches(t.rollback, t.original, t.managedLinks)) throw new Error(`Original identity mismatch: ${t.rollback}`)
        if (await present(t.live)) {
          if (!await matches(t.live, t.replacement, t.managedLinks)) throw new Error(`Live identity mismatch: ${t.live}`)
          if (await present(t.candidate)) throw new Error(`Ambiguous candidate: ${t.candidate}`)
          await durableRename(t.live, t.candidate)
        }
        await durableRename(t.rollback, t.live)
      } else if (t.original) {
        if (!await matches(t.live, t.original, t.managedLinks)) throw new Error(`Original missing: ${t.live}`)
      } else if (await present(t.live)) {
        if (!await matches(t.live, t.replacement, t.managedLinks) || await present(t.candidate)) throw new Error(`Ambiguous new target: ${t.live}`)
        await durableRename(t.live, t.candidate)
      }
      await this.fault?.('rollback-after', i)
    }
    j.phase = 'rolled-back'; await save(this.journalPath, j)
  }
  private async cleanup() {
    const j = this.journal
    if (!j.cleanupAuthorized) {
      // Establish the irreversible disposal decision durably before recursive rm.
      // Once authorized, interrupted deletions resume by root inode, not a content
      // hash that necessarily changes as child files are deleted.
      for (const t of j.targets) {
        await assertAncestors(t.live)
        const expected = j.phase === 'committed' ? t.replacement : t.original
        if (expected ? !await matches(t.live, expected, t.managedLinks) : !!await present(t.live)) throw new RestoreRecoveryError('Live target changed before transaction cleanup', this.journalPath)
        for (const [path, artifact] of [[t.candidate, t.replacement], [t.rollback, t.original]] as const) {
          if (await present(path) && !await matches(path, artifact, t.managedLinks)) throw new RestoreRecoveryError('Cleanup identity mismatch', this.journalPath)
        }
      }
      j.cleanupAuthorized = true
      await save(this.journalPath, j)
    }
    for (let i = 0; i < j.targets.length; i++) {
      const t = j.targets[i]
      await assertAncestors(t.live)
      for (const [path, expected] of [[t.candidate, t.replacement], [t.rollback, t.original]] as const) {
        const st = await present(path)
        if (st) {
          if (st.isSymbolicLink() || !expected || st.dev !== expected.dev || st.ino !== expected.ino) throw new RestoreRecoveryError('Disposable cleanup root identity mismatch', this.journalPath)
          await this.fault?.('cleanup-before', i)
          await rm(path, { recursive: true })
          await this.fault?.('cleanup-after', i)
        }
      }
    }
    await rm(this.journalPath); await syncRestoreDirectory(dirname(this.journalPath))
  }
  static async recover(root: string) {
    await assertAncestors(join(root, 'journal'))
    await mkdir(root, { recursive: true })
    for (const name of (await readdir(root)).filter(n => n.endsWith('.json')).sort()) {
      const path = join(root, name)
      try {
        const st = await lstat(path)
        if (!st.isFile() || st.isSymbolicLink() || st.size > 16 * 1024 * 1024) throw new Error('Invalid restore journal file')
        const j: Journal = JSON.parse(await readFile(path, 'utf8'))
        validate(j, root)
        if (name !== `${j.id}.json`) throw new Error('Restore journal filename mismatch')
        const tx = new RestoreTransaction(path, j)
        if (j.phase !== 'committed' && j.phase !== 'rolled-back') { await tx.finishStaging(); await tx.rollback() }
        await tx.cleanup()
      } catch (e) { throw new RestoreRecoveryError('Interrupted restore needs recovery; no evidence removed', path, e) }
    }
  }
}
