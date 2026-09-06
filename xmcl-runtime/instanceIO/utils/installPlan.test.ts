import type { InstanceFile, InstanceInstallLock } from '@xmcl/instance'
import { describe, expect, it } from 'vitest'
import { activeInstallFiles, hasInstallWork, installPathKey, supersedeInstallPlans } from './installPlan'

const file = (path: string, projectId?: string): InstanceFile => ({
  path,
  hashes: {},
  ...(projectId ? { modrinth: { projectId, versionId: path } } : {}),
})
const plan = (files: InstanceFile[], oldFiles: InstanceFile[] = []): InstanceInstallLock => ({
  version: 1,
  files,
  oldFiles,
  baseline: { files: oldFiles },
  upstream: { type: 'peer', id: '' },
  workspace: 'workspace',
  backup: 'backup',
  mtime: 0,
  finishedPath: [],
})

describe('installation plan ownership', () => {
  it('transfers renamed project files and leaves unrelated work with the older plan', () => {
    const old = file('mods/old.jar', 'project')
    const wanted = file('mods/new.jar', 'project')
    const unrelated = file('config/settings.txt')
    const previous = plan([old, unrelated])
    const result = supersedeInstallPlans(plan([wanted]), [{ path: 'old.json', state: previous }])
    expect(result.plan.baseline?.files).toEqual([old])
    expect(activeInstallFiles(result.superseded[0].state)).toEqual([unrelated])
    expect(previous.supersededPaths).toBeUndefined()
    expect(result.superseded[0].state.supersededPaths).toEqual([installPathKey(old.path)])
  })

  it('takes ownership of deferred deletions and preserves the incoming baseline content', () => {
    const old = file('config/options.txt')
    const original = { ...old, hashes: { sha1: 'original' } }
    const result = supersedeInstallPlans(plan([old], [original]), [
      { path: 'old.json', state: plan([], [old]) },
    ])
    expect(hasInstallWork(result.superseded[0].state)).toBe(false)
    expect(result.plan.baseline?.files).toEqual([original])
  })

  it('follows transitive cross-provider aliases', () => {
    const alias = { ...file('mods/a.jar', 'modrinth'), curseforge: { projectId: 1, fileId: 1 } }
    const older = { ...file('mods/b.jar'), curseforge: { projectId: 1, fileId: 2 } }
    const result = supersedeInstallPlans(plan([file('mods/new.jar', 'modrinth')]), [
      { path: 'older.json', state: plan([older]) },
      { path: 'alias.json', state: plan([alias]) },
    ])
    expect(result.superseded).toHaveLength(2)
    expect(result.superseded.every(profile => !hasInstallWork(profile.state))).toBe(true)
  })

  it('supersedes the whole previous upstream intent, including files absent from the newer manifest', () => {
    const previous = plan([file('mods/abandoned.jar')])
    const next = plan([file('mods/desired.jar')])
    delete previous.oldFiles
    delete next.oldFiles
    previous.upstream = next.upstream = { type: 'peer', id: 'pack' }
    const result = supersedeInstallPlans(next, [{ path: 'old.json', state: previous }])
    expect(hasInstallWork(result.superseded[0].state)).toBe(false)
    expect(result.plan.baseline?.files).toEqual(previous.files)
  })

  it('replays an interrupted ownership transfer without restoring already-superseded files', () => {
    const previous = plan([file('mods/old.jar', 'project')])
    const incoming = plan([file('mods/new.jar', 'project')])
    const first = supersedeInstallPlans(incoming, [{ path: 'old.json', state: previous }])
    const replay = supersedeInstallPlans(first.plan, [{ path: 'old.json', state: previous }])
    expect(replay).toEqual(first)
    const settled = supersedeInstallPlans(first.plan, first.superseded)
    expect(settled.plan).toEqual(first.plan)
    expect(settled.superseded).toEqual([])
  })
})
