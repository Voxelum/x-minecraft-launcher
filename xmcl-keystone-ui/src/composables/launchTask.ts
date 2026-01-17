import { Ref, InjectionKey } from 'vue'
import { useTask } from './task'
import { Instance } from '@xmcl/instance'

export const kLaunchTask: InjectionKey<ReturnType<typeof useLaunchTask>> = Symbol('LaunchTask')

export function useLaunchTask(path: Ref<string>, version: Ref<Instance['runtime']>, localVersion: Ref<string | undefined>) {
  return useTask((task) => {
    if (!path.value) return false

    if (task.type === 'installJre') {
      return true
    }
    if (task.type === 'installVersion') {
      return task.version === version.value.minecraft || task.version === localVersion.value
    }
    if (task.type === 'installLibraries') {
      return true
    }
    if (task.type === 'installAssets') {
      return task.version === version.value.minecraft ||
        task.version === localVersion.value ||
        task.version === version.value.minecraft.substring(version.value.minecraft.lastIndexOf('.'))
    }
    if (task.type === 'installForge') {
      return task.version === version.value.forge || task.mcversion === version.value.minecraft
    }
    if (task.type === 'installNeoForge') {
      return task.version === version.value.neoForged || task.minecraft === version.value.minecraft
    }
    if (task.type === 'installLabyMod') {
      return task.version === version.value.labyMod
    }
    if (task.type === 'installOptifine') {
      return task.version === version.value.optifine
    }
    if (task.type === 'installProfile') {
      return task.version === localVersion.value
    }
    if (task.type === 'installFabric') {
      return task.minecraft === version.value.minecraft
    }
    if (task.type === 'installQuilt') {
      return task.minecraft === version.value.minecraft
    }
    if (task.type === 'installInstance') {
      return task.instancePath === path.value
    }
    return false
  })
}
