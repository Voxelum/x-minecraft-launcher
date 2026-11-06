import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, readdir, symlink, readlink, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { XmclImport, recoverXmclImport } from './xmclImport'
import { UserPersistence } from '../user/UserPersistence'

let base: string
let source: string
let profile: string
let game: string
let importer: XmclImport
const json = async (path: string) => JSON.parse(await readFile(path, 'utf8'))
const put = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value))

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'vardrynn-import-test-'))
  source = join(base, 'xmcl')
  profile = join(base, 'vardrynn')
  game = join(base, 'old-games')
  await Promise.all([mkdir(source), mkdir(profile), mkdir(join(game, 'instances', 'World'), { recursive: true }), mkdir(join(game, 'versions', 'test'), { recursive: true })])
  await writeFile(join(source, 'root'), game)
  await put(join(source, 'setting.json'), { locale: 'fr', globalMaxMemory: 4096, autoDownload: true, agentEndpoint: 'https://api.xmcl.app', globalPreExecuteCommand: 'danger', httpProxy: 'http://secret@proxy' })
  await put(join(source, 'user.json'), { users: { player: { id: 'player', username: 'player@example.test', authority: 'x://microsoft', profiles: {}, selectedProfile: '', accessToken: 'SECRET', homeAccountId: 'SECRET', expiredAt: 9999999999999 } } })
  await put(join(source, 'instances.json'), { selectedInstance: 'World', instances: [], groups: ['World'] })
  await put(join(game, 'instances', 'World', 'instance.json'), { name: 'World', runtime: { minecraft: 'test' }, preExecuteCommand: 'danger', env: { TOKEN: 'SECRET' } })
  await writeFile(join(game, 'versions', 'test', 'test.jar'), 'minecraft')
  await writeFile(join(source, 'secret'), 'SECRET')
  await writeFile(join(profile, 'root'), join(base, 'previous-games'))
  await put(join(profile, 'setting.json'), { locale: 'en' })
  importer = new XmclImport(profile)
})
afterEach(async () => { await rm(base, { recursive: true, force: true }) })

describe('XMCL import', () => {
  it('previews compatible data without writing either profile', async () => {
    const before = await readdir(profile)
    const preview = await importer.preview(source)
    expect(preview).toMatchObject({ sourceProfile: await realpath(source), sourceRoot: await realpath(game), instances: 1, accounts: 1, files: 2 })
    expect(preview!.bytes).toBeGreaterThan(9)
    expect(await readdir(profile)).toEqual(before)
  })

  it('copies independently, filters secrets and hooks, activates once, and rolls back exactly', async () => {
    const before = await readFile(join(profile, 'setting.json'), 'utf8')
    const originalInstance = await readFile(join(game, 'instances', 'World', 'instance.json'), 'utf8')
    await importer.preview(source)
    await importer.copy()
    expect((await importer.status()).phase).toBe('ready')
    expect(await readFile(join(profile, 'root'), 'utf8')).toBe(join(base, 'previous-games'))
    await importer.activate()
    await recoverXmclImport(profile)
    const root = await readFile(join(profile, 'root'), 'utf8')
    expect(root).not.toBe(game)
    expect(await readFile(join(root, 'versions', 'test', 'test.jar'), 'utf8')).toBe('minecraft')
    expect(await json(join(profile, 'setting.json'))).toMatchObject({ locale: 'fr', globalMaxMemory: 4096, autoDownload: false, autoInstallOnAppQuit: false })
    expect(await readFile(join(profile, 'setting.json'), 'utf8')).not.toMatch(/secret|danger|api.xmcl/)
    const users = await json(join(profile, 'user.json'))
    expect(users.users.player).toMatchObject({ invalidated: true, expiredAt: -1 })
    expect(JSON.stringify(users)).not.toContain('SECRET')
    expect(await readFile(join(root, 'instances', 'World', 'instance.json'), 'utf8')).not.toMatch(/danger|SECRET/)
    expect(await readFile(join(game, 'instances', 'World', 'instance.json'), 'utf8')).toBe(originalInstance)
    await writeFile(join(root, 'versions', 'test', 'test.jar'), 'user-edited')
    await recoverXmclImport(profile)
    expect(await readFile(join(root, 'versions', 'test', 'test.jar'), 'utf8')).toBe('user-edited')
    await importer.rollback()
    await recoverXmclImport(profile)
    expect(await readFile(join(profile, 'root'), 'utf8')).toBe(join(base, 'previous-games'))
    expect(await readFile(join(profile, 'setting.json'), 'utf8')).toBe(before)
    expect(await readdir(profile)).not.toContain('user.json')
    expect(await readFile(join(root, 'versions', 'test', 'test.jar'), 'utf8')).toBe('user-edited')
    expect(await readFile(join(source, 'secret'), 'utf8')).toBe('SECRET')
  })

  it('never carries an XMCL account session into Vardrynn', async () => {
    // XMCL keeps its launcher-account session and DPoP key in <profile>/secret, separate from game accounts.
    await rm(join(source, 'secret'))
    await mkdir(join(source, 'secret'))
    await writeFile(join(source, 'secret', 'xmcl-xmcl-account-current-session'), 'XMCL-ACCOUNT-SESSION')
    await writeFile(join(source, 'secret', 'xmcl-xmcl-account-dpop-key'), 'XMCL-ACCOUNT-SESSION')
    await importer.preview(source)
    await importer.copy()
    await importer.activate()
    await recoverXmclImport(profile)
    const files = await readdir(profile, { recursive: true })
    expect(files.some(f => String(f).split(/[\\/]/)[0] === 'secret')).toBe(false)
    for (const file of files) {
      const path = join(profile, String(file))
      if ((await stat(path)).isFile()) expect(await readFile(path, 'utf8')).not.toContain('XMCL-ACCOUNT-SESSION')
    }
  })

  it('resumes an interrupted copy and repairs partial destination contents', async () => {
    await importer.preview(source)
    const running = importer.copy()
    importer.cancel()
    await running
    expect((await importer.status()).phase).toBe('cancelled')
    importer = new XmclImport(profile)
    await importer.preview(source)
    await importer.copy()
    const { destination } = await importer.status()
    await writeFile(join(destination!, 'versions', 'test', 'test.jar'), 'partial')
    await importer.copy()
    expect(await readFile(join(destination!, 'versions', 'test', 'test.jar'), 'utf8')).toBe('minecraft')
  })

  it('copies external instances and rebases shared internal links to the independent root', async () => {
    const external = join(base, 'external')
    await mkdir(external)
    await put(join(external, 'instance.json'), { name: 'External', runtime: { minecraft: 'test' } })
    await put(join(source, 'instances.json'), { selectedInstance: external, instances: [external], groups: [{ id: 'group', name: 'Group', color: 'red', instances: [external] }] })
    await symlink(join(game, 'versions'), join(game, 'instances', 'World', 'versions'), 'dir')
    await importer.preview(source)
    await importer.copy()
    await importer.activate()
    await recoverXmclImport(profile)
    const root = await readFile(join(profile, 'root'), 'utf8')
    expect(await readlink(join(root, 'instances', 'World', 'versions'))).toBe(join(root, 'versions'))
    const config = await json(join(profile, 'instances.json'))
    expect(config.selectedInstance).not.toBe(external)
    expect(config.groups[0].instances).toEqual([config.selectedInstance])
    expect(await json(join(root, 'instances', config.selectedInstance, 'instance.json'))).toMatchObject({ name: 'External' })
  })

  it('rejects links escaping the copied roots before writing a journal', async () => {
    await symlink(source, join(game, 'instances', 'World', 'escape'), 'dir')
    await expect(importer.preview(source)).rejects.toThrow(/link/i)
    expect(await readdir(profile)).toEqual(['root', 'setting.json'])
  })

  it('rejects overlapping profiles and source game roots', async () => {
    await expect(importer.preview(profile)).rejects.toThrow()
    await writeFile(join(source, 'root'), base)
    await expect(importer.preview(source)).rejects.toThrow(/overlap/i)
  })

  it('reports an interrupted copy as resumable and ignores a stray cancel', async () => {
    await importer.preview(source)
    await importer.copy()
    const file = join(profile, 'xmcl-import-v1', 'journal.json')
    await put(file, { ...await json(file), phase: 'copying' })
    const restarted = new XmclImport(profile)
    expect((await restarted.status()).phase).toBe('cancelled')
    restarted.cancel()
    await restarted.copy()
    expect((await restarted.status()).phase).toBe('ready')
  })

  it('keeps user recovery sidecars in step with activation and rollback', async () => {
    const persistence = new UserPersistence(join(profile, 'user.json'))
    const usernames = async () => Object.values((await persistence.load()).users.users).map(u => u.username)
    await writeFile(join(profile, 'user.json.backup'), JSON.stringify({ users: { old: { id: 'old', username: 'old@example.test', authority: 'x://microsoft', profiles: {}, selectedProfile: '' } } }))
    await importer.preview(source)
    await importer.copy()
    await importer.activate()
    await recoverXmclImport(profile)
    expect(await usernames()).toEqual(['player@example.test'])
    await writeFile(join(profile, 'user.json.backup'), await readFile(join(profile, 'user.json'), 'utf8'))
    await importer.rollback()
    await recoverXmclImport(profile)
    expect(await usernames()).toEqual(['old@example.test'])
  })

  it('skips recovery when the profile does not exist yet', async () => {
    await expect(recoverXmclImport(join(base, 'missing'))).resolves.toBeUndefined()
  })

  it('preserves executable file modes', async () => {
    await mkdir(join(game, 'jre'))
    await writeFile(join(game, 'jre', 'java'), 'java', { mode: 0o755 })
    await importer.preview(source)
    await importer.copy()
    const { destination } = await importer.status()
    expect((await stat(join(destination!, 'jre', 'java'))).mode & 0o777).toBe(0o755)
  })
})
