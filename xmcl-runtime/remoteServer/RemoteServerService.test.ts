import { describe, expect, it } from 'vitest'
import { createDeploymentFilePlan, type DeploymentManifest, type ResolvedDeploymentFile } from './deploymentPlan'

const policies = {
  config: 'mirror',
  mods: 'overlay',
  world: 'initialize',
  extra: 'preserve',
} as const

function file(target: string, category: ResolvedDeploymentFile['category'], fingerprint = 'sha1:new'): ResolvedDeploymentFile {
  return { source: target, target, category, policy: policies[category], fingerprint, size: 10 }
}

function manifest(files: DeploymentManifest['files']): DeploymentManifest {
  return { version: 2, files }
}

describe('createDeploymentFilePlan', () => {
  it('deletes only absent files in categories currently using mirror', () => {
    const previous = manifest({
      'config/old.toml': { category: 'config', fingerprint: 'sha1:old', policy: 'overlay' },
      'mods/old.jar': { category: 'mods', fingerprint: 'sha1:old', policy: 'mirror' },
      'plugins/old.jar': { category: 'extra', fingerprint: 'sha1:old', policy: 'mirror' },
    })

    const plan = createDeploymentFilePlan([], previous, policies, new Set())

    expect(plan.removedFiles).toEqual(['config/old.toml'])
    expect(plan.preview.delete).toBe(1)
  })

  it('adds, updates, and skips matching overlay files', () => {
    const previous = manifest({
      'mods/update.jar': { category: 'mods', fingerprint: 'sha1:old', policy: 'overlay' },
      'mods/same.jar': { category: 'mods', fingerprint: 'sha1:same', policy: 'overlay' },
    })
    const selected = [
      file('mods/new.jar', 'mods'),
      file('mods/update.jar', 'mods'),
      file('mods/same.jar', 'mods', 'sha1:same'),
    ]

    const plan = createDeploymentFilePlan(selected, previous, policies, new Set())

    expect(plan.preview).toEqual({ add: 1, update: 1, delete: 0, skip: 1, uploadBytes: 20 })
  })

  it('does not manage initialize files when the target root already exists', () => {
    const plan = createDeploymentFilePlan(
      [file('world/level.dat', 'world')],
      manifest({}),
      policies,
      new Set(['world']),
    )

    expect(plan.changedFiles).toEqual([])
    expect(plan.actions[0]).toMatchObject({ kind: 'skip', managed: false })
  })

  it('does not delete tracked files while their category is preserved', () => {
    const previous = manifest({
      'plugins/bridge.jar': { category: 'extra', fingerprint: 'sha1:old', policy: 'mirror' },
    })

    const plan = createDeploymentFilePlan([file('plugins/bridge.jar', 'extra')], previous, policies, new Set())

    expect(plan.removedFiles).toEqual([])
    expect(plan.preview.skip).toBe(1)
    expect(plan.changedFiles).toEqual([])
  })
})