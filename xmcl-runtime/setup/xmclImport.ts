import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { chmod, copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { AUTHORITY_DEV, AUTHORITY_MICROSOFT, InstancesSchema, SettingSchema, Users, type XmclImportPreview, type XmclImportStatus } from '@xmcl/runtime-api'

const profileFiles = ['root', 'setting.json', 'instances.json', 'user.json'] as const
type ProfileFile = typeof profileFiles[number]
// UserPersistence recovers accounts from these, so they must change together with user.json.
const userSidecars = ['user.json.backup', 'user.json.meta'] as const
const snapshotFiles = [...profileFiles, ...userSidecars]
type Payload = Record<ProfileFile, string>
type Entry = { source: string; target: string; size: number; mtime: number; mode: number; link?: string }
type Plan = { preview: XmclImportPreview; entries: Entry[]; payload: Payload }
type Journal = { version: 1; phase: XmclImportStatus['phase']; plan: Plan }
const gameEntries = ['assets', 'instances', 'jre', 'libraries', 'labymod-neo', 'modpacks', 'mods', 'resourcepacks', 'saves', 'shaderpacks', 'versions', 'options.txt', 'servers.dat']
const compatibleSettings = ['locale', 'theme', 'globalMinMemory', 'globalMaxMemory', 'globalAssignMemory', 'globalFastLaunch', 'globalHideLauncher', 'globalShowLog', 'globalResolution', 'globalSyncGameLanguage', 'replaceNatives', 'enableDedicatedGPUOptimization', 'linuxTitlebar', 'windowTranslucent', 'maxSockets', 'maxAPISockets'] as const

const inside = (root: string, path: string) => {
  const r = relative(root, path)
  return r === '' || (!r.startsWith('..' + requireSeparator()) && r !== '..' && !isAbsolute(r))
}
const requireSeparator = () => process.platform === 'win32' ? '\\' : '/'
const overlaps = (a: string, b: string) => inside(a, b) || inside(b, a)
const encode = (value: unknown) => JSON.stringify(value, null, 2)

async function exists(path: string) {
  return lstat(path).then(() => true, (e) => { if (e.code === 'ENOENT') return false; throw e })
}

async function regularFile(path: string) {
  if (!(await lstat(path)).isFile()) throw new Error('Expected a regular file; symbolic links are not imported as profile files.')
  return readFile(path, 'utf8')
}

async function optionalJson(path: string): Promise<any> {
  if (!await exists(path)) return {}
  return JSON.parse(await regularFile(path))
}

async function atomic(path: string, contents: string | Buffer) {
  await mkdir(dirname(path), { recursive: true })
  if (await exists(path) && !(await lstat(path)).isFile()) throw new Error('Refusing to replace a non-file in the import destination.')
  const temporary = path + '.vardrynn-tmp'
  await rm(temporary, { force: true })
  await writeFile(temporary, contents, { mode: 0o600, flag: 'wx' })
  await rename(temporary, path)
}

async function digest(path: string) {
  const hash = createHash('sha256')
  for await (const bytes of createReadStream(path)) hash.update(bytes)
  return hash.digest('hex')
}

function importDirectory(profile: string) { return join(profile, 'xmcl-import-v1') }

// Neither copy nor rollback may traverse user-created links in their destination.
async function safeDirectory(root: string, path: string) {
  if (!inside(root, path)) throw new Error('Import destination escapes its owned directory.')
  const parent = dirname(path)
  if (path !== root) await safeDirectory(root, parent)
  if (await exists(path)) {
    if (!(await lstat(path)).isDirectory()) throw new Error('Import destination contains a link or non-directory.')
  } else {
    await mkdir(path)
  }
}

async function readJournal(profile: string): Promise<Journal | undefined> {
  const root = importDirectory(profile)
  if (!await exists(root)) return undefined
  if (!(await lstat(root)).isDirectory()) throw new Error('Import journal directory must not be a symbolic link.')
  const file = join(root, 'journal.json')
  if (!await exists(file)) return undefined
  const journal: Journal = JSON.parse(await regularFile(file))
  if (journal.version !== 1 || journal.plan?.payload?.root !== join(importDirectory(await realpath(profile)), 'game')) throw new Error('Unsupported or invalid import journal.')
  return journal
}

async function saveJournal(profile: string, journal: Journal) {
  await safeDirectory(profile, importDirectory(profile))
  await atomic(join(importDirectory(profile), 'journal.json'), encode(journal))
}

function safeSettings(raw: unknown) {
  const parsed = SettingSchema.parse(raw)
  const safe = Object.fromEntries(compatibleSettings.map(key => [key, parsed[key]]))
  return SettingSchema.parse({ ...safe, autoDownload: false, autoInstallOnAppQuit: false, disableTelemetry: true, discordPresence: false })
}

function safeUsers(raw: unknown) {
  const parsed = Users.parse(raw)
  const users = Object.fromEntries(Object.entries(parsed.users).flatMap(([id, user]) => {
    const authority = user.authority || (user.authService === 'microsoft' ? AUTHORITY_MICROSOFT : user.authService === 'offline' ? AUTHORITY_DEV : '')
    if (authority !== AUTHORITY_MICROSOFT && authority !== AUTHORITY_DEV) return []
    return [[id, { ...user, authority, authService: undefined, invalidated: authority !== AUTHORITY_DEV, expiredAt: -1 }]]
  }))
  return { users }
}

/** Read-only discovery: no journal, profile or game writes before explicit copy. */
async function buildPlan(profile: string, source: string): Promise<Plan> {
  source = await realpath(source)
  profile = await realpath(profile)
  const sourceRoot = await realpath((await exists(join(source, 'root'))) ? (await regularFile(join(source, 'root'))).trim() : source)
  if (overlaps(profile, source) || overlaps(profile, sourceRoot)) throw new Error('XMCL source and Vardrynn destination must not overlap.')
  const destination = join(importDirectory(profile), 'game')
  const config = InstancesSchema.parse(await optionalJson(join(source, 'instances.json')).then(async value => Object.keys(value).length ? value : optionalJson(join(sourceRoot, 'instances.json'))))
  const roots: Array<{ from: string; to: string }> = [{ from: sourceRoot, to: destination }]
  const instances = new Map<string, string>()
  const aliases = new Map<string, string>()
  const managed = join(sourceRoot, 'instances')
  if (await exists(managed)) {
    if (!(await lstat(managed)).isDirectory()) throw new Error('Instances directory must not be a symbolic link.')
    for (const name of await readdir(managed)) {
      const path = join(managed, name)
      if (name.startsWith('.') || !await exists(join(path, 'instance.json'))) continue
      if (!(await lstat(path)).isDirectory()) throw new Error('Instance directory must not be a symbolic link.')
      instances.set(await realpath(path), name)
    }
  }
  for (const path of config.instances) {
    const absolute = isAbsolute(path) ? path : join(managed, path)
    const canonical = await realpath(absolute)
    aliases.set(resolve(absolute), canonical)
    if (instances.has(canonical)) continue
    if (overlaps(profile, canonical) || overlaps(source, canonical) || overlaps(sourceRoot, canonical)) throw new Error('External instance roots must not overlap launcher profiles or other copied roots.')
    const name = `imported-${instances.size + 1}`
    roots.push({ from: canonical, to: join(destination, 'instances', name) })
    instances.set(canonical, name)
  }
  const entries: Entry[] = []
  const scan = async (path: string, target: string): Promise<void> => {
    const info = await lstat(path)
    if (info.isDirectory()) {
      for (const child of (await readdir(path)).sort()) await scan(join(path, child), join(target, child))
    } else if (info.isSymbolicLink()) {
      const canonical = await realpath(path)
      const mapping = [...roots].reverse().find(r => inside(r.from, canonical))
      if (!mapping) throw new Error('A symbolic link points outside the copied game roots. Remove or replace it before importing.')
      entries.push({ source: path, target, size: 0, mtime: info.mtimeMs, mode: info.mode, link: join(mapping.to, relative(mapping.from, canonical)) })
    } else if (info.isFile()) {
      entries.push({ source: path, target, size: info.size, mtime: info.mtimeMs, mode: info.mode })
    } else {
      throw new Error('An unsupported file type was found in the game data.')
    }
  }
  for (const name of gameEntries) {
    if (await exists(join(sourceRoot, name))) await scan(join(sourceRoot, name), name)
  }
  for (const root of roots.slice(1)) await scan(root.from, relative(destination, root.to))
  const remap = (path: string) => {
    if (!path) return ''
    const absolute = resolve(isAbsolute(path) ? path : join(managed, path))
    return instances.get(aliases.get(absolute) || absolute) || ''
  }
  const instanceConfig = {
    selectedInstance: remap(config.selectedInstance),
    instances: [...instances.values()],
    groups: config.groups.flatMap<typeof config.groups[number]>(group => typeof group === 'string'
      ? (remap(group) ? [remap(group)] : [])
      : [{ ...group, instances: group.instances.map(remap).filter(Boolean) }]),
  }
  const settings = safeSettings(await optionalJson(join(source, 'setting.json')))
  const users = safeUsers(await optionalJson(join(source, 'user.json')))
  return {
    preview: { sourceProfile: source, sourceRoot, destination, instances: instances.size, accounts: Object.keys(users.users).length, files: entries.length, bytes: entries.reduce((n, e) => n + e.size, 0) },
    entries,
    payload: { root: destination, 'setting.json': encode(settings), 'instances.json': encode(instanceConfig), 'user.json': encode(users) },
  }
}

/** Versioned, copy-only import. A restart activates it before runtime readers start. */
export class XmclImport {
  private plan?: Plan
  private busy = false
  private cancelled = false
  private progress?: XmclImportStatus

  private profile: string

  constructor(profile: string) { this.profile = profile }

  // Plans hold canonical paths, so every entry point works from the canonical profile too.
  private async resolve() { this.profile = await realpath(this.profile) }

  async preview(source = join(dirname(this.profile), 'xmcl')): Promise<XmclImportPreview | undefined> {
    if (this.busy) throw new Error('An import is already running.')
    await this.resolve()
    if (!await exists(source)) return undefined
    this.plan = await buildPlan(this.profile, source)
    return this.plan.preview
  }

  async status(): Promise<XmclImportStatus> {
    await this.resolve()
    if (this.progress) return { ...this.progress }
    const journal = await readJournal(this.profile)
    const preview = journal?.plan.preview
    // A persisted 'copying' with nothing running is an interrupted copy, which is resumable.
    const phase = journal?.phase === 'copying' ? 'cancelled' : journal?.phase || 'idle'
    return { phase, sourceProfile: preview?.sourceProfile, destination: preview?.destination, copiedFiles: 0, totalFiles: preview?.files || 0, copiedBytes: 0, totalBytes: preview?.bytes || 0 }
  }

  cancel() { if (this.busy) this.cancelled = true }

  async copy() {
    if (this.busy) throw new Error('An import is already running.')
    this.busy = true
    try {
      await this.resolve()
      const previous = await readJournal(this.profile)
      if (previous && !['copying', 'cancelled', 'failed', 'ready'].includes(previous.phase)) throw new Error('This import is already activated or rolled back. Its files are retained; it cannot be overwritten.')
      const selected = this.plan || previous?.plan
      if (!selected) throw new Error('Preview the XMCL profile before importing.')
      const plan = await buildPlan(this.profile, selected.preview.sourceProfile)
      if (encode(plan) !== encode(selected)) throw new Error('XMCL data changed after the preview. Close XMCL and preview again before retrying.')
      if (previous && previous.plan.preview.sourceProfile !== plan.preview.sourceProfile) throw new Error('Resume the original XMCL source; this copy belongs to another profile.')
      const journal: Journal = { version: 1, phase: 'copying', plan }
      await saveJournal(this.profile, journal)
      this.progress = { phase: 'copying', sourceProfile: plan.preview.sourceProfile, destination: plan.preview.destination, copiedFiles: 0, totalFiles: plan.preview.files, copiedBytes: 0, totalBytes: plan.preview.bytes }
      await safeDirectory(this.profile, plan.preview.destination)
      for (const entry of plan.entries) {
        if (this.cancelled) break
        const target = join(plan.preview.destination, entry.target)
        if (!inside(plan.preview.destination, target)) throw new Error('Invalid import target.')
        await safeDirectory(this.profile, dirname(target))
        const before = await lstat(entry.source)
        if (before.mtimeMs !== entry.mtime || before.size !== entry.size && !entry.link) throw new Error('XMCL changed while copying. Close it and preview again.')
        if (entry.link) {
          if (!inside(plan.preview.destination, entry.link)) throw new Error('Invalid import link target.')
          if (await exists(target)) {
            if (!(await lstat(target)).isSymbolicLink()) throw new Error('Import link conflicts with an existing file.')
            await rm(target)
          }
          await symlink(entry.link, target, (await stat(entry.source)).isDirectory() ? 'junction' : 'file')
        } else {
          if (await exists(target) && !(await lstat(target)).isFile()) throw new Error('Import file conflicts with a link or directory.')
          const sourceHash = await digest(entry.source)
          if (!await exists(target) || await digest(target) !== sourceHash) {
            const temporary = target + '.vardrynn-copy'
            await rm(temporary, { force: true })
            await copyFile(entry.source, temporary)
            if (await digest(temporary) !== sourceHash) throw new Error('XMCL changed while copying. Close it and retry.')
            await chmod(temporary, entry.mode & 0o777)
            await utimes(temporary, before.atime, before.mtime)
            await rename(temporary, target)
          }
        }
        this.progress.copiedFiles++
        this.progress.copiedBytes += entry.size
      }
      journal.phase = this.cancelled ? 'cancelled' : 'ready'
      if (journal.phase === 'ready') {
        // Instance launch hooks/credentials and absolute source references are not portable.
        const config = JSON.parse(plan.payload['instances.json'])
        for (const name of config.instances) {
          const file = join(plan.preview.destination, 'instances', name, 'instance.json')
          const instance = await optionalJson(file)
          for (const key of ['path', 'java', 'vmOptions', 'mcOptions', 'prependCommand', 'preExecuteCommand', 'env', 'server', 'fileApi', 'playtime', 'lastAccessDate']) delete instance[key]
          if (instance.upstream?.type === 'peer') delete instance.upstream
          for (const key of ['icon', 'background']) if (typeof instance[key] === 'string' && (isAbsolute(instance[key]) || /^(file:|image:|launcher:|https?:)/.test(instance[key]))) delete instance[key]
          await atomic(file, encode(instance))
        }
      }
      await saveJournal(this.profile, journal)
      this.progress.phase = journal.phase
    } catch (e) {
      if (this.progress?.phase === 'copying') {
        this.progress.phase = 'failed'
        this.progress.error = 'Import stopped. Check available disk space and close XMCL, then preview and retry.'
        const journal = await readJournal(this.profile)
        if (journal) { journal.phase = 'failed'; await saveJournal(this.profile, journal) }
      }
      throw e
    } finally {
      this.busy = false
      this.cancelled = false
    }
  }

  private async queue(from: string[], to: Journal['phase']) {
    await this.resolve()
    if (this.busy) throw new Error('Wait for the copy to stop first.')
    const journal = await readJournal(this.profile)
    if (!journal || !from.includes(journal.phase)) throw new Error('The import is not ready for this action.')
    journal.phase = to
    await saveJournal(this.profile, journal)
    this.progress = undefined
  }

  activate() { return this.queue(['ready'], 'activate-pending') }
  rollback() { return this.queue(['applied'], 'rollback-pending') }
}

/** Called with the launcher's single-instance lock, before constructing runtime services. */
export async function recoverXmclImport(profile: string) {
  if (!await exists(profile)) return
  profile = await realpath(profile)
  const journal = await readJournal(profile)
  if (!journal || !['activate-pending', 'applying', 'rollback-pending'].includes(journal.phase)) return
  const backup = join(importDirectory(profile), 'before.json')
  if (journal.phase === 'activate-pending') {
    const before = Object.fromEntries(await Promise.all(snapshotFiles.map(async file => [file, await exists(join(profile, file)) ? Buffer.from(await regularFile(join(profile, file))).toString('base64') : null])))
    await atomic(backup, encode(before))
    journal.phase = 'applying'
    await saveJournal(profile, journal)
  }
  const before = JSON.parse(await regularFile(backup))
  for (const file of snapshotFiles) {
    if (!(file in before) || before[file] !== null && typeof before[file] !== 'string') throw new Error('Invalid import rollback snapshot.')
  }
  if (journal.phase === 'rollback-pending') {
    for (const file of snapshotFiles) {
      if (before[file] === null) {
        if (await exists(join(profile, file)) && !(await lstat(join(profile, file))).isFile()) throw new Error('Rollback target is not a regular file.')
        await rm(join(profile, file), { force: true })
      } else {
        await atomic(join(profile, file), Buffer.from(before[file], 'base64'))
      }
    }
    journal.phase = 'rolled-back'
  } else {
    for (const file of profileFiles) await atomic(join(profile, file), journal.plan.payload[file])
    for (const file of userSidecars) await rm(join(profile, file), { force: true })
    journal.phase = 'applied'
  }
  await saveJournal(profile, journal)
}
