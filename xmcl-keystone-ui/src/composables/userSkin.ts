import { computed, InjectionKey, onMounted, reactive, Ref, toRefs, watch } from 'vue'
import { GameProfileAndTexture, UserServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'
import steveSkin from '@/assets/steve_skin.png'

export function usePlayerName(gameProfile: Ref<GameProfileAndTexture>) {
  const name = ref(gameProfile.value.name)
  watch(computed(() => gameProfile.value.name), (v) => { name.value = v })
  return name
}

export function useUserSkin(userId: Ref<string>, gameProfile: Ref<GameProfileAndTexture>) {
  const { uploadSkin, saveSkin } = useService(UserServiceKey)
  const data = reactive({
    /**
     * The skin url
     */
    skin: '',
    /**
     * The cape url
     */
    cape: '' as string | undefined,
    slim: false,
    loading: false,
    inferModelType: false,
  })

  const currentSkin = computed(() => gameProfile.value?.textures.SKIN.url)
  const currentSlim = computed(() => gameProfile.value.textures.SKIN.metadata ? gameProfile.value?.textures.SKIN.metadata.model === 'slim' : false)
  const currentCape = computed(() => gameProfile.value.capes ? gameProfile.value.capes?.find(c => c.state === 'ACTIVE')?.url : gameProfile.value.textures.CAPE?.url)
  const uploadable = computed(() => gameProfile.value.uploadable ? gameProfile.value.uploadable : ['skin', 'cape'])
  const canUploadSkin = computed(() => uploadable.value.indexOf('skin') !== -1)
  const canUploadCape = computed(() => uploadable.value.indexOf('cape') !== -1)

  function reset() {
    const prof = gameProfile.value
    if (!prof) return
    data.cape = currentCape.value
    data.skin = prof.textures.SKIN.url || steveSkin
    data.slim = prof.textures.SKIN.metadata ? prof.textures.SKIN.metadata.model === 'slim' : false
  }
  const skinModified = computed(() => (data.skin !== currentSkin.value && data.skin !== steveSkin) || data.slim !== currentSlim.value)
  const capeModified = computed(() => data.cape !== currentCape.value)
  const modified = computed(() => skinModified.value || capeModified.value)

  async function save() {
    data.loading = true
    try {
      if (!modified.value) return
      await uploadSkin({
        skin: skinModified.value ? { url: data.skin, slim: data.slim } : undefined,
        cape: capeModified.value ? (data.cape ?? '') : undefined,
        userId: userId.value,
        gameProfileId: gameProfile.value.id,
      })
    } finally {
      data.loading = false
    }
  }

  onMounted(() => {
    reset()
  })
  watch(gameProfile, () => {
    reset()
  })

  return {
    ...toRefs(data),
    canUploadCape,
    canUploadSkin,
    save,
    reset,
    modified,

    exportTo: saveSkin,
  }
}

export const UserSkinModel: InjectionKey<ReturnType<typeof useUserSkin>> = Symbol('UserSkinModel')
export const PlayerCapeModel: InjectionKey<Ref<string | undefined>> = Symbol('PlayerCapeModel')
export const PlayerNameModel: InjectionKey<Ref<string>> = Symbol('PlayerNameModel')
export const UserSkinRenderPaused: InjectionKey<Ref<boolean>> = Symbol('UserSkinRenderPaused')
