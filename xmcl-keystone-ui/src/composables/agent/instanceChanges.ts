import type { InstanceFile } from '@xmcl/instance'
import type { InstanceFileUpdate, InstanceInstallService } from '@xmcl/runtime-api'

export interface InstanceChangeSet {
  label: string
  oldFiles: InstanceFile[]
  files: InstanceFile[]
}

export interface InstanceChangeOperations {
  add(change: InstanceChangeSet): Promise<unknown>
  status(): Promise<unknown>
  apply(): Promise<unknown>
  reset(): Promise<unknown>
}

export function createInstanceChangeOperations(options: {
  currentInstancePath: () => string | undefined
  instanceInstall: Pick<InstanceInstallService, 'previewInstanceFiles' | 'installInstanceFiles'>
}): InstanceChangeOperations {
  const { currentInstancePath, instanceInstall } = options
  let path: string | undefined
  const oldFiles = new Map<string, InstanceFile>()
  const files = new Map<string, InstanceFile>()
  const labels: string[] = []

  function ensurePath(): string | undefined {
    const current = currentInstancePath()
    if (path !== current) {
      path = current
      oldFiles.clear()
      files.clear()
      labels.length = 0
    }
    return current
  }

  function summarize(change: InstanceChangeSet) {
    return {
      label: change.label,
      remove: change.oldFiles.map((file) => file.path),
      add: change.files.map((file) => file.path),
    }
  }

  async function preview(removed: InstanceFile[], added: InstanceFile[]): Promise<InstanceFileUpdate[]> {
    const instancePath = ensurePath()
    if (!instancePath) return []
    return instanceInstall.previewInstanceFiles({ path: instancePath, oldFiles: removed, files: added })
  }

  async function add(change: InstanceChangeSet) {
    if (!ensurePath()) return { error: 'no instance selected' }
    for (const file of change.oldFiles) {
      const wasAddedByChangeList = files.has(file.path) && !oldFiles.has(file.path)
      files.delete(file.path)
      if (!wasAddedByChangeList && !oldFiles.has(file.path)) oldFiles.set(file.path, file)
    }
    for (const file of change.files) files.set(file.path, file)
    labels.push(change.label)
    return {
      added: summarize(change),
      changeList: await status(),
      note: 'Added to the instance change list. Add more changes or run `bash instance change apply`.',
    }
  }

  async function status() {
    const instancePath = ensurePath()
    if (!instancePath) return { error: 'no instance selected' }
    const removed = [...oldFiles.values()]
    const added = [...files.values()]
    return {
      instancePath,
      changes: {
        labels: [...labels],
        remove: removed.map((file) => file.path),
        add: added.map((file) => file.path),
      },
      preview: removed.length || added.length ? await preview(removed, added) : [],
    }
  }

  async function apply() {
    const instancePath = ensurePath()
    if (!instancePath) return { error: 'no instance selected' }
    const removed = [...oldFiles.values()]
    const added = [...files.values()]
    if (!removed.length && !added.length) return { applied: false, note: 'No instance changes to apply.' }
    const appliedLabels = [...labels]
    await instanceInstall.installInstanceFiles({
      path: instancePath,
      oldFiles: removed,
      files: added,
      id: crypto.getRandomValues(new Uint8Array(8)).join(''),
    })
    oldFiles.clear()
    files.clear()
    labels.length = 0
    return {
      applied: true,
      labels: appliedLabels,
      removed: removed.map((file) => file.path),
      added: added.map((file) => file.path),
    }
  }

  async function reset() {
    ensurePath()
    oldFiles.clear()
    files.clear()
    labels.length = 0
    return { reset: true }
  }

  return { add, status, apply, reset }
}
