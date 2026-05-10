import { protocolToMinecraft, ServerStatus } from '@xmcl/runtime-api'
import { computed, Ref } from 'vue'

/**
 * Reverse index of `protocolToMinecraft`. First match wins, which mirrors
 * what the launcher prefers when only the protocol is known.
 */
const minecraftToProtocol: Record<string, number> = (() => {
  const map: Record<string, number> = {}
  for (const [proto, versions] of Object.entries(protocolToMinecraft)) {
    for (const v of versions) {
      if (!(v in map)) map[v] = Number(proto)
    }
  }
  return map
})()

/**
 * Map a Minecraft version string to a Minecraft network protocol number so
 * `ServerStatusService.pingServer` can announce a matching handshake. Used
 * by every server-status ping that originates from an instance.
 */
export function useMinecraftProtocol(minecraft: Ref<string | undefined>) {
  return computed(() => {
    const v = minecraft.value
    return v ? minecraftToProtocol[v] : undefined
  })
}

export function useProtocolAcceptVersion(protocol: Ref<number>) {
  return computed(() => `[${protocolToMinecraft[protocol.value].join(', ')}]`)
}

export function useSeverStatusAcceptVersion(status: Ref<ServerStatus>) {
  return computed(() => `[${(protocolToMinecraft[status.value.version.protocol] ?? []).join(', ')}]`)
}
