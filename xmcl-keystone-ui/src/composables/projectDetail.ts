import type { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
import { basename } from '@/util/basename'
import { ProjectFile } from '@/util/search'
import { Ref } from 'vue'

export function useProjectDetailEnable<T extends ProjectFile>(
  selectedVersion: Ref<ProjectVersion | undefined>,
  installedFiles: Ref<T[]>,
  updating: Ref<boolean>,
  enable: (file: T) => void,
  disable: (file: T) => void,
) {
  const selectedFile = computed(() => {
    const ver = selectedVersion.value
    if (!ver) return undefined
    if ((ver as any).installedFile) {
      return (ver as any).installedFile as T
    }
    const verName = ver.name?.toLowerCase()
    const verVersion = ver.version?.toLowerCase()
    const verFiles: string[] = Array.isArray((ver as any).files)
      ? (ver as any).files.map((f: any) => (typeof f === 'string' ? f : f?.filename || '').toLowerCase()).filter(Boolean)
      : []

    const file = installedFiles.value?.find(v => {
      if (v.modrinth?.versionId === ver.id) return true
      if (v.curseforge?.fileId === Number(ver.id)) return true
      if (v.path === ver.id) return true

      const vFileName = ('fileName' in v && typeof (v as any).fileName === 'string' ? (v as any).fileName : '')?.toLowerCase()
      const vBaseName = (v.path ? basename(v.path) : '')?.toLowerCase()

      if (vFileName && (vFileName === verVersion || vFileName === verName)) return true
      if (vBaseName && (vBaseName === verVersion || vBaseName === verName)) return true

      if (verFiles.length > 0) {
        if (vFileName && verFiles.includes(vFileName)) return true
        if (vBaseName && verFiles.includes(vBaseName)) return true
      }
      return false
    })
    return file
  })

  const enabled = computed({
    get: () => {
      return selectedFile.value?.enabled ?? false
    },
    set: (v: boolean) => {
      const file = selectedFile.value
      if (!file) return
      updating.value = true
      if (v) {
        enable(file)
      } else {
        disable(file)
      }
    },
  })
  const installed = computed(() => !!selectedFile.value)
  const hasInstalledVersion = computed(() => installedFiles.value.length > 0)

  return {
    installed,
    enabled,
    hasInstalledVersion,
  }
}

export function useProjectDetailUpdate() {
  let lastTimeout: any
  const updating = ref(false)
  watch(updating, (v) => {
    if (v) {
      lastTimeout = setTimeout(() => {
        updating.value = false
      }, 3_000)
    } else {
      clearTimeout(lastTimeout)
    }
  })
  return updating
}
