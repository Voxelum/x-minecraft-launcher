import { TaskState } from '@xmcl/runtime-api'
import { useInstance, useInstanceVersion } from './instance'
import { useTask } from './task'

export function useLaunchTask() {
  const { path, instance } = useInstance()
  const version = computed(() => instance.value.runtime)
  const { localVersion } = useInstanceVersion()
  return useTask((i) => {
    const p = i.param as any
    if (i.state === TaskState.Cancelled || i.state === TaskState.Succeed || i.state === TaskState.Failed) {
      return false
    }
    if (i.path === 'installVersion' && p?.id === version.value.minecraft) {
      return true
    }
    if (i.path === 'installVersion.jar' && (p?.id === localVersion.value.id || p?.id === version.value.minecraft)) {
      return true
    }
    if (i.path === 'installLibraries' && (p?.id === localVersion.value.id || p?.id === version.value.minecraft)) {
      return true
    }
    if (i.path === 'installAssets' && (p?.id === localVersion.value.id || p?.id === version.value.minecraft || p?.id === version.value.minecraft.substring(version.value.minecraft.lastIndexOf('.')))) {
      return true
    }
    if (i.path === 'installForge' && (p?.id === version.value.forge || p?.id === localVersion.value.id)) {
      return true
    }
    if (i.path === 'installOptifine' && p?.id === version.value.optifine) {
      return true
    }
    if (i.path === 'installByProfile' && p?.id === localVersion.value.id) {
      return true
    }
    if (i.path === 'installFabric' && p?.id === version.value.minecraft) {
      return true
    }
    if (i.path === 'installInstance' && p.instance === path.value) {
    // installing this instance
      return true
    }
    return false
  })
}
