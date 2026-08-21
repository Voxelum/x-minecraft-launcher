import { useLocalStorage } from '@vueuse/core'
import { computed, Ref, ref } from 'vue'
import steveSkin from '@/assets/steve_skin.png'

export interface SkinLibraryItem {
  id: string
  name: string
  url: string
  slim: boolean
  dateAdded: number
  isPreset?: boolean
}

export const PRESET_SKINS: SkinLibraryItem[] = []

export function useUserSkinLibrary() {
  const customSkins = useLocalStorage<SkinLibraryItem[]>('xmcl_user_skin_library', [], { writeDefaults: true })
  const equippedSkinId = useLocalStorage<string>('xmcl_equipped_skin_id', '', { writeDefaults: true })

  const allSkins = computed(() => customSkins.value)

  function addSkin(item: { name: string; url: string; slim: boolean }) {
    const newSkin: SkinLibraryItem = {
      id: 'skin-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      name: item.name.trim() || 'Custom Skin',
      url: item.url,
      slim: item.slim,
      dateAdded: Date.now(),
    }
    customSkins.value = [newSkin, ...customSkins.value]
    return newSkin
  }

  function removeSkin(id: string) {
    customSkins.value = customSkins.value.filter(s => s.id !== id)
  }

  function updateSkin(id: string, updates: Partial<Pick<SkinLibraryItem, 'name' | 'slim'>>) {
    const index = customSkins.value.findIndex(s => s.id === id)
    if (index !== -1) {
      customSkins.value[index] = {
        ...customSkins.value[index],
        ...updates,
      }
      customSkins.value = [...customSkins.value]
    }
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

  return {
    customSkins,
    presetSkins: PRESET_SKINS,
    allSkins,
    equippedSkinId,
    addSkin,
    removeSkin,
    updateSkin,
    fetchSkinFromUsername,
  }
}
