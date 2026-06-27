import { computed } from 'vue'
import { AUTHORITY_MICROSOFT } from '@xmcl/runtime-api'

import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'

/**
 * Whether the currently-selected account owns a Minecraft license.
 *
 * A Microsoft account only receives a Minecraft game profile when it actually
 * owns the game (the profile lookup otherwise fails with
 * `ProfileNotFoundError`). We use that as the ownership signal: a Microsoft user
 * with at least one valid game profile owns Minecraft, which grants both the
 * Java and Bedrock Edition on PC.
 *
 * This gates the Bedrock Edition entry points so they are only visible to users
 * who actually have a license.
 */
export function useHasMinecraftLicense() {
  const { userProfile } = injection(kUserContext)
  const hasMinecraftLicense = computed(() => {
    const profile = userProfile.value
    if (!profile || profile.authority !== AUTHORITY_MICROSOFT) return false
    return Object.values(profile.profiles).some((p) => !!p.id)
  })
  return { hasMinecraftLicense }
}
