import { ref } from 'vue'
import type { BackupManifest } from '@xmcl/runtime-api'

/** A reset invalidates in-flight archive reads, including native file pickers. */
export function useBackupSelection() {
  const path = ref('')
  const manifest = ref<BackupManifest | null>(null)
  const instances = ref<string[]>([])
  let generation = 0
  function reset() {
    generation++
    path.value = ''
    manifest.value = null
    instances.value = []
  }
  function token() { return generation }
  function isCurrent(value: number) { return value === generation }
  function accept(value: number, archivePath: string, archive: BackupManifest) {
    if (!isCurrent(value)) return false
    path.value = archivePath
    manifest.value = archive
    instances.value = archive.includes.instances.map(i => i.folderName)
    return true
  }
  return { path, manifest, instances, reset, token, isCurrent, accept }
}
