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

  const allSkins = computed(() => customSkins.value)

  async function refresh() {
    loading.value = true
    try {
      const state = await service.getState()
      customSkins.value = state.skins
      equippedSkinIds.value = state.equippedSkinIds
    } finally {
      loading.value = false
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

  async function fetchSkinFromUsername(username: string): Promise<{ url: string; slim: boolean }> {
    const cleanUser = username.trim()
    try {
      const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(cleanUser)}`)
      if (profileRes.ok) {
        const profileData = await profileRes.json()
        if (profileData?.id) {
          const sessionRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${profileData.id}`)
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json()
            const textureProp = sessionData?.properties?.find((p: any) => p.name === 'textures')
            if (textureProp?.value) {
              const decoded = JSON.parse(atob(textureProp.value))
              const skinUrl = decoded?.textures?.SKIN?.url
              const isSlim = decoded?.textures?.SKIN?.metadata?.model === 'slim'
              if (skinUrl) {
                return { url: skinUrl, slim: isSlim }
              }
            }
          }
        }
      }
    } catch {
      // Fallback
    }

    return {
      url: `https://minotar.net/skin/${encodeURIComponent(cleanUser)}`,
      slim: false,
    }
  }

  onMounted(refresh)

  return {
    customSkins,
    presetSkins: PRESET_SKINS,
    allSkins,
    equippedSkinIds,
    loading,
    addSkin,
    removeSkin,
    updateSkin,
    setEquippedSkin,
    fetchSkinFromUsername,
  }
})
