import type { InstanceFile, InstanceInstallLock } from '@xmcl/instance'
import { isUpstreamIsSameOrigin } from '@xmcl/runtime-api'

export function installPathKey(path: string) {
  const normalized = path.replace(/\\/g, '/')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function identities(file: InstanceFile) {
  const result = [`path:${installPathKey(file.path)}`]
  if (file.curseforge) result.push(`curseforge:${file.curseforge.projectId}`)
  if (file.modrinth) result.push(`modrinth:${file.modrinth.projectId}`)
  return result
}

export function activeInstallFiles(state: InstanceInstallLock, baseline = false) {
  const superseded = new Set(state.supersededPaths ?? [])
  const files = baseline ? (state.baseline?.files ?? state.oldFiles ?? []) : state.files
  return files.filter(file => !superseded.has(installPathKey(file.path)))
}

export function hasInstallWork(state: InstanceInstallLock) {
  return activeInstallFiles(state).length > 0 || activeInstallFiles(state, true).length > 0
}

/**
 * Transfer overlapping ownership, including old filenames of the same project.
 * Persist the new plan before these older revisions so interrupted registration
 * can safely replay the transfer on resume.
 */
export function supersedeInstallPlans(
  incoming: InstanceInstallLock,
  previous: Array<{ path: string; state: InstanceInstallLock }>,
) {
  const keys = new Set([
    ...activeInstallFiles(incoming),
    ...activeInstallFiles(incoming, true),
  ].flatMap(identities))
  if (incoming.oldFiles === undefined) {
    for (const { state } of previous) {
      if (state.oldFiles === undefined && isUpstreamIsSameOrigin(incoming.upstream, state.upstream)) {
        for (const file of [...activeInstallFiles(state), ...activeInstallFiles(state, true)]) {
          for (const identity of identities(file)) keys.add(identity)
        }
      }
    }
  }
  const transferred = new Map<string, InstanceFile>()
  let changed: boolean
  do {
    changed = false
    for (const { state } of previous) {
      for (const file of [...activeInstallFiles(state, true), ...activeInstallFiles(state)]) {
        const ids = identities(file)
        if (!ids.some(id => keys.has(id))) continue
        transferred.set(installPathKey(file.path), file)
        for (const id of ids) {
          if (!keys.has(id)) {
            keys.add(id)
            changed = true
          }
        }
      }
    }
  } while (changed)

  const baseline = new Map(transferred)
  for (const file of incoming.baseline?.files ?? incoming.oldFiles ?? []) {
    baseline.set(installPathKey(file.path), file)
  }
  const plan: InstanceInstallLock = {
    ...incoming,
    baseline: { ...incoming.baseline, files: [...baseline.values()] },
  }
  const superseded = previous.flatMap(({ path, state }) => {
    const paths = [...activeInstallFiles(state, true), ...activeInstallFiles(state)]
      .filter(file => identities(file).some(id => keys.has(id)))
      .map(file => installPathKey(file.path))
    if (!paths.length) return []
    return [{
      path,
      state: {
        ...state,
        supersededPaths: [...new Set([...(state.supersededPaths ?? []), ...paths])],
      },
    }]
  })
  return { plan, superseded }
}
