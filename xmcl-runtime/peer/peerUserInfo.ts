import { GameProfileAndTexture } from '@xmcl/runtime-api'

export function createPeerUserInfo() {
  let gameProfile: GameProfileAndTexture | undefined
  const setUserInfo = (profile: GameProfileAndTexture) => {
    gameProfile = profile
  }
  return {
    setUserInfo,
    getUserInfo: () => {
      const profile = gameProfile
      return {
        name: profile?.name ?? 'Player',
        avatar: profile?.textures.SKIN.url ?? '',
        id: profile?.id ?? '',
        textures: profile?.textures ?? {
          SKIN: { url: '' },
        },
      }
    },
  }
}
