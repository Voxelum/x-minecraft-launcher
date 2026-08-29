import { AUTHORITY_DEV, AuthorityMetadata, UserProfile } from '@xmcl/runtime-api'
import { offline } from '@xmcl/user'
import { LauncherAppPlugin } from '~/app'
import { ImageStorage } from '~/infra'
import { UserService } from './UserService'
import { kUserTokenStorage } from './userTokenStore'
import { getUUID } from './utils/offlineUser'
import { normalizeSkinData } from './user'

export const pluginOffineUser: LauncherAppPlugin = async (app) => {
  const OFFLINE_USER_ID = 'OFFLINE'
  const offlineAuthUrl = (process.env.XMCL_OFFLINE_AUTH_URL || 'https://xmcl-offline-auth.kc-dev-py.workers.dev').replace(/\/$/, '')

  const userService = await app.registry.get(UserService)
  const userTokenStorage = await app.registry.get(kUserTokenStorage)
  const imageStore = await app.registry.get(ImageStorage)
  userService.getUserState().then((state) => {
    const offlineUsers = state.users[OFFLINE_USER_ID]
    if (offlineUsers) {
      let modified = false
      for (const [k, v] of Object.entries(offlineUsers.profiles)) {
        const expectedUUID = getUUID(v.name)
        if (k !== expectedUUID) {
          modified = true
          v.id = expectedUUID
          delete offlineUsers.profiles[k]
          offlineUsers.profiles[expectedUUID] = v
        }
      }
      if (modified) {
        state.userProfile(offlineUsers)
      }
    }
  })
  userService.registerAccountSystem(AUTHORITY_DEV, {
    async login({ username, password, properties }) {
      // Steve is the built-in passwordless account. Every other offline
      // account must be verified by the hosted account service first.
      let verifiedUuid = username.toLowerCase() === 'steve' && !password ? getUUID(username) : undefined
      let hostedAccessToken: string | undefined
      let hostedCapeUrl: string | undefined
      if (!verifiedUuid) {
        if (!password) throw new Error('A password is required for this offline account.')
        const response = await app.fetch(`${offlineAuthUrl}/v1/accounts/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username, password }),
        })
        const result = await response.json().catch(() => undefined) as { error?: string; token?: string; account?: { offlineUuid?: string; capeUrl?: string } } | undefined
        if (!response.ok || !result?.account?.offlineUuid || !result.token) throw new Error(result?.error || 'Invalid offline username or password.')
        verifiedUuid = result.account.offlineUuid
        hostedAccessToken = result.token
        hostedCapeUrl = result.account.capeUrl
      }
      const auth = offline(username, verifiedUuid)
      if (hostedAccessToken) auth.accessToken = hostedAccessToken
      const profileId = verifiedUuid
      auth.selectedProfile.id = profileId

      // Keep each offline username as an independent account. The original
      // implementation stored every offline login under the single `OFFLINE`
      // id, which made accounts overwrite/merge each other's selected profile
      // and made account-specific settings ambiguous.
      const existed = Object.values(userService.state.users).find((user) => {
        if (user.authority !== AUTHORITY_DEV) return false
        return Object.values(user.profiles).some((profile) => profile.name.toLowerCase() === username.toLowerCase())
      })

      if (existed) {
        const selectedProfile = Object.values(existed.profiles).find((profile) => profile.name.toLowerCase() === username.toLowerCase())
        const profile = {
          ...existed,
          selectedProfile: selectedProfile?.id ?? profileId,
        }
        await userTokenStorage.put(profile, auth.accessToken)
        return profile
      }

      const profiles = {
        [profileId]: {
          name: username,
          id: profileId,
          uploadable: ['cape', 'skin'] as ('cape' | 'skin')[],
          textures: {
            SKIN: {
              url: '',
              metadata: {},
            },
            ...(hostedCapeUrl ? { CAPE: { url: hostedCapeUrl } } : {}),
          },
        },
      }

      const profile: UserProfile = {
        id: `${OFFLINE_USER_ID}-${profileId}`,
        invalidated: false,
        selectedProfile: profileId,
        profiles,
        expiredAt: Number.MAX_SAFE_INTEGER / 100 * 95,
        authority: AUTHORITY_DEV,
        username,
      }
      await userTokenStorage.put(profile, auth.accessToken)

      return profile
    },
    async setSkin(p, gameProfile, { skin, cape }, signal) {
      const isHostedAccount = p.username.toLowerCase() !== 'steve'
      // Startup refresh is intentionally non-blocking, so the user can reach
      // the skin editor before it finishes. Refresh here as well to extend a
      // still-valid hosted session before using it for an upload.
      if (isHostedAccount) {
        try {
          await userService.refreshUser(p.id, { silent: true, force: true })
        } catch {
          throw new Error('Offline account session expired. Log in again to upload a skin.')
        }
      }
      const token = isHostedAccount ? await userTokenStorage.get(p) : undefined
      if (skin !== undefined) {
        if (skin) {
          let url = skin.url
          if (isHostedAccount) {
            if (!token) throw new Error('Offline account session expired. Log in again to upload a skin.')
            const image = await normalizeSkinData(url)
            console.log(`[pluginOfflineUser] Upload hosted skin for ${p.username} to ${offlineAuthUrl}`)
            const response = await app.fetch(`${offlineAuthUrl}/v1/accounts/me/skin`, {
              method: 'PUT',
              headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'image/png',
                'x-skin-model': skin.slim ? 'slim' : 'steve',
              },
              body: image,
              signal,
            })
            const result = await response.json().catch(() => undefined) as { error?: string; account?: { skinUrl?: string; skinModel?: 'steve' | 'slim' } } | undefined
            if (response.status === 401) throw new Error('Offline account session expired. Log in again to upload a skin.')
            if (!response.ok || !result?.account?.skinUrl) throw new Error(result?.error || 'Failed to upload offline skin.')
            url = result.account.skinUrl
            gameProfile.textures.SKIN.metadata = { model: result.account.skinModel || (skin.slim ? 'slim' : 'steve') }
          } else if (!url.startsWith('http')) {
            url = await imageStore.addImage(url)
          }
          gameProfile.textures.SKIN.url = url
          if (!gameProfile.textures.SKIN.metadata) gameProfile.textures.SKIN.metadata = { model: skin.slim ? 'slim' : 'steve' }
        } else {
          gameProfile.textures.SKIN.url = ''
          gameProfile.textures.SKIN.metadata = undefined
        }
      }
      if (cape !== undefined) {
        if (cape) {
          let url = cape
          if (p.username.toLowerCase() !== 'steve') {
            if (!token) throw new Error('Offline account session expired. Log in again to upload a cape.')
            const image = await normalizeSkinData(url)
            const response = await app.fetch(`${offlineAuthUrl}/v1/accounts/me/cape`, {
              method: 'PUT',
              headers: { authorization: `Bearer ${token}`, 'content-type': 'image/png' },
              body: image,
              signal,
            })
            const result = await response.json().catch(() => undefined) as { error?: string; account?: { capeUrl?: string } } | undefined
            if (response.status === 401) throw new Error('Offline account session expired. Log in again to upload a cape.')
            if (!response.ok || !result?.account?.capeUrl) throw new Error(result?.error || 'Failed to upload offline cape.')
            url = result.account.capeUrl
          } else if (!url.startsWith('http')) {
            url = await imageStore.addImage(url)
          }
          gameProfile.textures.CAPE = { url }
        } else {
          if (p.username.toLowerCase() !== 'steve') {
            if (!token) throw new Error('Offline account session expired. Log in again to remove a cape.')
            const response = await app.fetch(`${offlineAuthUrl}/v1/accounts/me/cape`, {
              method: 'DELETE',
              headers: { authorization: `Bearer ${token}` },
              signal,
            })
            if (response.status === 401) throw new Error('Offline account session expired. Log in again to remove a cape.')
          }
          gameProfile.textures.CAPE = undefined
        }
      }
      return p
    },
    async refresh(p) {
      if (p.username.toLowerCase() === 'steve') return p
      const token = await userTokenStorage.get(p)
      if (!token) throw new Error('Offline account session expired. Log in again.')
      const response = await app.fetch(`${offlineAuthUrl}/v1/accounts/me`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Offline account session expired. Log in again.')
      const result = await response.json().catch(() => undefined) as { expiresAt?: string; account?: { capeUrl?: string } } | undefined
      if (result?.expiresAt) {
        const expiresAt = Date.parse(result.expiresAt)
        if (Number.isFinite(expiresAt)) p.expiredAt = expiresAt
      }
      const profile = p.profiles[p.selectedProfile]
      if (profile && result?.account && 'capeUrl' in result.account) {
        profile.textures.CAPE = result.account.capeUrl ? { url: result.account.capeUrl } : undefined
      }
      return p
    },
    getSupporetedAuthorityMetadata: function (allowThirdparty: boolean): AuthorityMetadata[] {
      if (!allowThirdparty) return []
      return [
        {
          authority: AUTHORITY_DEV,
          flow: ['anonymous'],
          kind: 'builtin',
        }
      ]
    }
  })
}
