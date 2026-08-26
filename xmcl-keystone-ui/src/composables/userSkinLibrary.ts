import { createSharedComposable } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { LocalSkin, LocalSkinServiceKey } from '@xmcl/runtime-api'
import { useService } from '@/composables'

export type SkinLibraryItem = LocalSkin

export const PRESET_SKINS: SkinLibraryItem[] = []

export const useUserSkinLibrary = createSharedComposable(() => {
  const service = useService(LocalSkinServiceKey)
  const customSkins = ref<SkinLibraryItem[]>([])
  const equippedSkinIds = ref<Record<string, string>>({})
  const loading = ref(false)
  let refreshRequest = 0

  const allSkins = computed(() => customSkins.value)

  async function refresh() {
    const request = ++refreshRequest
    loading.value = true
    try {
      const state = await service.getState()
      if (request === refreshRequest) {
        customSkins.value = state.skins
        equippedSkinIds.value = state.equippedSkinIds
      }
    } finally {
      if (request === refreshRequest) loading.value = false
    }
  }

  async function addSkin(item: { name: string; url: string; slim: boolean }) {
    const newSkin = await service.addSkin({ name: item.name, source: item.url, slim: item.slim })
    customSkins.value = [newSkin, ...customSkins.value]
    return newSkin
  }

  async function removeSkin(id: string) {
    await service.removeSkin(id)
    customSkins.value = customSkins.value.filter(s => s.id !== id)
    equippedSkinIds.value = Object.fromEntries(Object.entries(equippedSkinIds.value).filter(([, skinId]) => skinId !== id))
  }

  async function updateSkin(id: string, updates: Partial<Pick<SkinLibraryItem, 'name' | 'slim'>>) {
    const updated = await service.updateSkin(id, updates)
    const index = customSkins.value.findIndex(s => s.id === id)
    if (index !== -1) {
      customSkins.value[index] = updated
      customSkins.value = [...customSkins.value]
    }
    return updated
  }

  async function setEquippedSkin(account: string, id: string) {
    await service.setEquippedSkin(account, id)
    equippedSkinIds.value = { ...equippedSkinIds.value, [account]: id }
  }

  async function fetchSkinFromUsername(username: string, authority: string) {
    return service.resolveSkin(authority, username)
  }

  onMounted(refresh)

  return {
    customSkins,
    presetSkins: PRESET_SKINS,
    allSkins,
    equippedSkinIds,
    loading,
    refresh,
    addSkin,
    removeSkin,
    updateSkin,
    setEquippedSkin,
    fetchSkinFromUsername,
  }
})
