import type { ServerDeploymentPolicy } from '@xmcl/instance'
import type { ServerDeploymentFile, ServerDeploymentPlan, ServerDeploymentPreview } from '@xmcl/runtime-api'

export interface DeploymentManifest {
  version: 2
  files: Record<string, {
    category: ServerDeploymentFile['category']
    fingerprint: string
    policy: Exclude<ServerDeploymentPolicy, 'preserve'>
  }>
}

export interface ResolvedDeploymentFile {
  source: string
  target: string
  category: ServerDeploymentFile['category']
  policy: ServerDeploymentPolicy
  fingerprint: string
  size: number
}

export function createDeploymentFilePlan(
  selectedFiles: ResolvedDeploymentFile[],
  previousManifest: DeploymentManifest,
  policies: ServerDeploymentPlan['policies'],
  existingInitializeRoots: ReadonlySet<string>,
) {
  const currentFiles = new Set(selectedFiles.map(file => file.target))
  const removedFiles = Object.entries(previousManifest.files)
    .filter(([path, record]) => policies[record.category] === 'mirror' && !currentFiles.has(path))
    .map(([path]) => path)
  const actions = selectedFiles.map((file) => {
    const previous = previousManifest.files[file.target]
    const root = file.target.includes('/') ? file.target.slice(0, file.target.indexOf('/')) : file.target
    if (file.policy === 'preserve') return { kind: 'skip' as const, file, managed: !!previous }
    if (file.policy === 'initialize' && (!previous && existingInitializeRoots.has(root) || !!previous)) {
      return { kind: 'skip' as const, file, managed: !!previous }
    }
    if (previous?.fingerprint === file.fingerprint) return { kind: 'skip' as const, file, managed: true }
    return { kind: previous ? 'update' as const : 'add' as const, file, managed: true }
  })
  const changedFiles = actions
    .filter(action => action.kind === 'add' || action.kind === 'update')
    .map(action => action.file)
  const preview: ServerDeploymentPreview = {
    add: actions.filter(action => action.kind === 'add').length,
    update: actions.filter(action => action.kind === 'update').length,
    delete: removedFiles.length,
    skip: actions.filter(action => action.kind === 'skip').length,
    uploadBytes: changedFiles.reduce((total, file) => total + file.size, 0),
  }
  return { actions, changedFiles, removedFiles, preview }
}