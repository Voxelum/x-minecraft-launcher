import { kInstance } from '@/composables/instance'
import { useService } from '@/composables/service'
import { kInstanceServerInfo } from '@/composables/instanceServerInfo'
import { useServerStatus } from '@/composables/serverStatus'
import { useMinecraftProtocol } from '@/composables/protocol'
import { injection } from '@/util/inject'
import { InstanceServiceKey, protocolToMinecraft } from '@xmcl/runtime-api'
import { Ref, computed, ref, watch } from 'vue'

/**
 * Notify-only "update from server upstream" helper. When the instance has a
 * `type: 'server'` upstream, this pings the server and surfaces a suggested
 * Minecraft version when the reported protocol differs from the instance's
 * current runtime. Applying the suggestion only edits `runtime.minecraft`;
 * loader resolution is left to the regular instance install path.
 */
export function useServerUpstream() {
  const { instance } = injection(kInstance)
  const { addServer, servers } = injection(kInstanceServerInfo)
  const { editInstance } = useService(InstanceServiceKey)

  const upstreamServer = computed(() => {
    const u = instance.value?.upstream
    if (u?.type !== 'server') return undefined
    return { host: u.host, port: u.port, name: u.name }
  })

  const isBound = computed(() => !!upstreamServer.value)

  const serverRef = computed(() => upstreamServer.value ?? { host: '' })
  const currentProtocol = useMinecraftProtocol(computed(() => instance.value?.runtime.minecraft))
  const { status, refresh } = useServerStatus(serverRef, currentProtocol)

  /** The Minecraft version that the pinged server most likely runs. */
  const reportedMinecraft = computed<string | undefined>(() => {
    const p = status.value?.version?.protocol
    if (typeof p !== 'number' || p < 0) return undefined
    const versions = protocolToMinecraft[p]
    return versions && versions.length > 0 ? versions[0] : undefined
  })

  /** Suggested upgrade target when the server's MC differs from ours. */
  const suggestedMinecraft = computed<string | undefined>(() => {
    if (!isBound.value) return undefined
    const reported = reportedMinecraft.value
    if (!reported) return undefined
    const current = instance.value?.runtime.minecraft
    if (!current || current === reported) return undefined
    return reported
  })

  async function applyUpdate() {
    if (!instance.value || !suggestedMinecraft.value) return
    await editInstance({
      instancePath: instance.value.path,
      runtime: { ...instance.value.runtime, minecraft: suggestedMinecraft.value },
    })
  }

  /**
   * Make sure the upstream server appears as a row in this instance's
   * `servers.dat`. Idempotent: skipped when a matching row already exists.
   */
  async function ensureInServersDat() {
    const s = upstreamServer.value
    if (!instance.value || !s) return
    const existing = servers.value.find((row) => {
      const parsed = parseIp(row.ip)
      if (parsed.host !== s.host) return false
      return (parsed.port ?? 25565) === (s.port ?? 25565)
    })
    if (existing) return
    await addServer({
      instancePath: instance.value.path,
      host: s.host,
      port: s.port,
      name: s.name || s.host,
    })
  }

  // Auto-ensure on bind / when the bound target changes.
  watch(upstreamServer, async (next, prev) => {
    if (!next) return
    if (prev && prev.host === next.host && (prev.port ?? 25565) === (next.port ?? 25565)) return
    await ensureInServersDat()
  }, { immediate: true })

  return {
    isBound,
    upstreamServer,
    status,
    refresh,
    reportedMinecraft,
    suggestedMinecraft,
    applyUpdate,
    ensureInServersDat,
  }
}

function parseIp(ip: string): { host: string; port?: number } {
  if (!ip) return { host: '' }
  const v6 = /^\[([^\]]+)\](?::(\d+))?$/.exec(ip)
  if (v6) return { host: v6[1], port: v6[2] ? Number(v6[2]) : undefined }
  const idx = ip.lastIndexOf(':')
  if (idx >= 0 && /^\d+$/.test(ip.slice(idx + 1))) {
    return { host: ip.slice(0, idx), port: Number(ip.slice(idx + 1)) }
  }
  return { host: ip }
}

export type ServerUpstreamHandle = ReturnType<typeof useServerUpstream>
