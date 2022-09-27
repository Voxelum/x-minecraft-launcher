import { computed, InjectionKey, onMounted, reactive, Ref, toRefs, watch } from '@vue/composition-api'
import { GameProfileAndTexture, UserServiceKey } from '@xmcl/runtime-api'
import { useServiceBusy, useServiceOnly } from '/@/composables'

export function usePlayerName(gameProfile: Ref<GameProfileAndTexture>) {
  const name = ref(gameProfile.value.name)
  watch(computed(() => gameProfile.value.name), (v) => { name.value = v })
  return name
}

export function usePlayerCape(gameProfile: Ref<GameProfileAndTexture>) {
  const capeVal = computed(() => gameProfile.value.capes?.find(c => c.state === 'ACTIVE')?.url || gameProfile.value.textures.CAPE?.url)
  const cape = ref(capeVal.value)
  watch(capeVal, (v) => { cape.value = v })
  return cape
}

export function useUserSkin(userId: Ref<string>, gameProfile: Ref<GameProfileAndTexture>) {
  const { refreshSkin, uploadSkin, saveSkin } = useServiceOnly(UserServiceKey, 'refreshSkin', 'uploadSkin', 'saveSkin')
  const data = reactive({
    skin: '',
    slim: false,
    loading: false,
  })

  function reset() {
    const prof = gameProfile.value
    if (!prof) return
    data.skin = prof.textures.SKIN.url
    data.slim = prof.textures.SKIN.metadata ? prof.textures.SKIN.metadata.model === 'slim' : false
  }
  const modified = computed(() => data.skin !== gameProfile.value?.textures.SKIN.url ||
    data.slim !== (gameProfile.value.textures.SKIN.metadata ? gameProfile.value?.textures.SKIN.metadata.model === 'slim' : false))

  async function save() {
    data.loading = true
    try {
      await uploadSkin({ url: data.skin, slim: data.slim, userId: userId.value, gameProfileId: gameProfile.value.id })
      await refreshSkin({ userId: userId.value, gameProfileId: gameProfile.value.id }).then(() => reset())
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
    refreshing: useServiceBusy(UserServiceKey, 'refreshSkin'),
    save,
    reset,
    modified,

    exportTo: saveSkin,
  }
}

export const UserSkinModel: InjectionKey<ReturnType<typeof useUserSkin>> = Symbol('UserSkinModel')
export const PlayerCapeModel: InjectionKey<Ref<string | undefined>> = Symbol('PlayerCapeModel')
export const PlayerNameModel: InjectionKey<Ref<string>> = Symbol('PlayerNameModel')
