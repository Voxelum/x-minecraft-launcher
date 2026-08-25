import { getInstanceManifestFingerprintSource, type InstanceFile, type InstanceManifest } from '@xmcl/instance'
import { createGlobalState, useLocalStorage } from '@vueuse/core'

const defaultSharingRoots = [
  'mods/',
  'resourcepacks/',
  'shaderpacks/',
  'config/',
  'scripts/',
  'theme/',
]
const defaultSharingFiles = new Set(['options.txt', 'optionsof.txt', 'theme.json'])

export function getDefaultInstanceSharingFiles(files: InstanceFile[]) {
  return files
    .filter((file) =>
      defaultSharingFiles.has(file.path) ||
      defaultSharingRoots.some((root) => file.path.startsWith(root)),
    )
    .filter((file) => !file.path.endsWith('.disabled'))
    .map((file) => file.path)
}

export function resolveInstanceSharingPath(runningInstancePaths: string[], selectedInstancePath: string) {
  return runningInstancePaths.includes(selectedInstancePath)
    ? selectedInstancePath
    : runningInstancePaths[0] ?? ''
}

export const useInstanceSharingPreferences = createGlobalState(() => {
  const filesByInstance = useLocalStorage<Record<string, string[]>>(
    'peerInstanceSharingFiles',
    {},
  )

  function getFiles(instancePath: string, files: InstanceFile[]) {
    const selected = filesByInstance.value[instancePath]
    if (!selected) return getDefaultInstanceSharingFiles(files)
    const available = new Set(files.map((file) => file.path))
    return selected.filter((path) => available.has(path))
  }

  function setFiles(instancePath: string, files: string[]) {
    filesByInstance.value = {
      ...filesByInstance.value,
      [instancePath]: [...files],
    }
  }

  return { filesByInstance, getFiles, setFiles }
})

export async function createScopedInstanceManifest(
  manifest: InstanceManifest,
  selectedFiles: string[],
) {
  const selected = new Set(selectedFiles)
  const scoped: InstanceManifest = {
    ...manifest,
    files: manifest.files.filter((file) => selected.has(file.path)),
  }
  const source = new TextEncoder().encode(getInstanceManifestFingerprintSource(scoped))
  const digest = await crypto.subtle.digest('SHA-256', source)
  scoped.fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  return scoped
}

export function getInstanceSharingRevisionSource(manifest: InstanceManifest) {
  return JSON.stringify([
    manifest.runtime,
    manifest.files.map((file) => [file.path, file.size, file.hashes]),
  ])
}
