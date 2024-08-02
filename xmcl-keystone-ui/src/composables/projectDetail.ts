import type { ProjectVersion } from '@/components/MarketProjectDetailVersion.vue'
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
    const file = installedFiles.value?.find(v => v.modrinth?.versionId === ver.id || v.curseforge?.fileId === Number(ver.id) || v.path === ver.id)
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
