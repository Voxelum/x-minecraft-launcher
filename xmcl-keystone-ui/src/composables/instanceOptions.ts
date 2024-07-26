import { GameOptionsState, InstanceOptionsServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useService } from './service'
import { useState } from './syncableState'

export const kInstanceOptions: InjectionKey<ReturnType<typeof useInstanceOptions>> = Symbol('InstanceOptions')

export function useInstanceOptions(instancePath: Ref<string>) {
  const { editGameSetting, watch: watchOptions } = useService(InstanceOptionsServiceKey)
  const { state, isValidating, error } = useState(() => instancePath.value ? watchOptions(instancePath.value) : undefined, GameOptionsState)
  const { locale } = useI18n()

  watch(state, (newOps) => {
    if (newOps) {
      if (newOps.lang === '') {
        editGameSetting({
          instancePath: instancePath.value,
          lang: locale.value.toLowerCase().replace('-', '_'),
          resourcePacks: newOps.resourcePacks,
        })
      }
    }
  })
  // watch(state, (newOps) => {
  //   if (newOps) {
  //     editGameSetting({
  //       instancePath: instance.value.path,
  //       resourcePacks: newOps.resourcePacks,
  //       anaglyph3d: newOps.anaglyph3d,
  //       ao: newOps.ao,
  //       useVbo: newOps.useVbo,
  //       enableVsync: newOps.enableVsync,
  //       difficulty: newOps.difficulty,
  //       entityShadows: newOps.entityShadows,
  //       fboEnable: newOps.fboEnable,
  //       fullscreen: newOps.fullscreen,
  //       renderDistance: newOps.renderDistance,
  //       fancyGraphics: newOps.fancyGraphics,
  //       renderClouds: newOps.renderClouds,
  //       lang: newOps.lang,
  //     })
  //   }
  // }, { deep: true })

  return {
    gameOptions: state,
    isValidating,
    error,
  }
}
