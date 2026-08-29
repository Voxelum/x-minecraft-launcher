import { computed, InjectionKey, onMounted, reactive, Ref, toRefs, watch } from 'vue'
import { AUTHORITY_DEV, AUTHORITY_MICROSOFT, GameProfileAndTexture, UserServiceKey, UserProfile } from '@xmcl/runtime-api'
import { useService } from '@/composables'
import steveSkin from '@/assets/steve_skin.png'
import { normalizeSkinImage } from '@/util/normalizeSkin'

export function usePlayerName(gameProfile: Ref<GameProfileAndTexture>) {
  const name = ref(gameProfile.value.name)
  watch(computed(() => gameProfile.value.name), (v) => { name.value = v })
  return name
}

export function useUserSkin(userId: Ref<string>, gameProfile: Ref<GameProfileAndTexture>, user?: Ref<UserProfile | undefined>) {
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

  const activeSkinUrl = computed(() => (gameProfile.value?.skins ? gameProfile.value.skins.find(s => s.state === 'ACTIVE')?.url : undefined) || gameProfile.value?.textures?.SKIN?.url || steveSkin)
  const activeSlim = computed(() => {
    const active = gameProfile.value?.skins?.find(s => s.state === 'ACTIVE')
    if (active) return active.variant === 'SLIM'
    return gameProfile.value?.textures?.SKIN?.metadata ? gameProfile.value.textures.SKIN.metadata.model === 'slim' : false
  })
  const activeCapeUrl = computed(() => (gameProfile.value?.capes ? gameProfile.value.capes.find(c => c.state === 'ACTIVE')?.url : undefined) || gameProfile.value?.textures?.CAPE?.url)

  const currentSkin = computed(() => activeSkinUrl.value)
  const currentSlim = computed(() => activeSlim.value)
  const currentCape = computed(() => activeCapeUrl.value)
  const uploadable = computed(() => {
    if (gameProfile.value?.uploadable) return gameProfile.value.uploadable
    const authority = user?.value?.authority
    return authority === AUTHORITY_MICROSOFT || authority === AUTHORITY_DEV ? ['skin', 'cape'] : []
  })
  const canUploadSkin = computed(() => uploadable.value.indexOf('skin') !== -1)
  const canUploadCape = computed(() => uploadable.value.indexOf('cape') !== -1)

  function reset() {
    const prof = gameProfile.value
    if (!prof) return
    data.cape = activeCapeUrl.value
    data.skin = activeSkinUrl.value
    data.slim = activeSlim.value
    // Do not trust stale model metadata. SkinView will inspect the unused arm
    // columns and report the model encoded by the actual PNG.
    data.inferModelType = true
  }
  const skinModified = computed(() => data.skin !== currentSkin.value || data.slim !== currentSlim.value)
  const capeModified = computed(() => data.cape !== currentCape.value)
  const modified = computed(() => skinModified.value || capeModified.value)

  async function save() {
    data.loading = true
    try {
      if (!modified.value) return
      const skin = skinModified.value
        ? { url: await normalizeSkinImage(data.skin), slim: data.slim }
        : undefined
      await uploadSkin({
        skin,
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
  watch(() => gameProfile.value?.id, (newId, oldId) => {
    if (newId !== oldId) {
      reset()
    }
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
