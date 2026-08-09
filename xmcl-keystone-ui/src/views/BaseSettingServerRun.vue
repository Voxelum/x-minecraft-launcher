<template>
  <SettingCard class="base-setting-card--wide">
    <div class="flex flex-col gap-5" data-testid="server-shared-settings">
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="select-text"
      >
        <div class="font-weight-medium">{{ errorTitle }}</div>
        <div
          v-if="errorDescription"
          class="text-caption opacity-90"
          v-html="errorDescription"
        />
      </v-alert>

      <!-- EULA acceptance (launch action lives in the header) -->
      <div
        ref="eulaBox"
        data-testid="server-eula"
        class="eula-box flex items-center gap-3 rounded-lg px-2"
        :class="{ 'eula-box--alert': eulaShake }"
      >
        <v-checkbox
          v-model="isAcceptEula"
          density="compact"
          hide-details
          class="flex-shrink-0"
        >
          <template #label>
            <i18n-t
              keypath="eula.body"
              tag="span"
              class="text-body-2"
            >
              <template #eula>
                <a
                  href="https://aka.ms/MinecraftEULA"
                  target="_blank"
                  class="text-primary"
                  @click.stop
                >EULA</a>
              </template>
            </i18n-t>
          </template>
        </v-checkbox>
      </div>

      <!-- Server settings -->
      <section data-testid="server-properties">
        <div class="server-run__section-header">
          <v-icon
            size="small"
            color="primary"
          >
            tune
          </v-icon>
          <span class="text-subtitle-2 font-weight-medium">
            {{ t('baseSetting.title') }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <v-text-field
            v-model="motd"
            :label="t('server.motd')"
            variant="outlined"
            density="compact"
            hide-details
          />
          <v-text-field
            v-model="port"
            :label="t('server.port')"
            variant="outlined"
            density="compact"
            type="number"
            hide-details
          />
          <v-text-field
            v-model="maxPlayers"
            :label="t('server.maxPlayers')"
            variant="outlined"
            density="compact"
            type="number"
            hide-details
          />
        </div>
        <div class="flex items-center gap-6 pt-1">
          <v-checkbox
            v-model="nogui"
            :label="t('server.nogui')"
            density="compact"
            hide-details
          />
          <v-checkbox
            v-model="onlineMode"
            :label="t('server.onlineMode')"
            density="compact"
            hide-details
          />
        </div>
      </section>

      <!-- Save selection -->
      <section data-testid="server-worlds">
        <div class="server-run__section-header">
          <v-icon
            size="small"
            color="primary"
          >
            public
          </v-icon>
          <span class="text-subtitle-2 font-weight-medium">
            {{ t('save.name') }}
          </span>
        </div>

        <v-item-group
          v-model="selectedSave"
          mandatory
        >
          <div class="grid grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
            <v-item v-slot="{ isSelected, toggle }">
              <button
                type="button"
                class="save-card"
                :class="{ 'save-card--selected': isSelected }"
                @click="toggle"
              >
                <v-icon
                  size="48"
                  :color="isSelected ? 'primary' : ''"
                >
                  {{ rawWorldExists ? 'save' : 'add_circle_outline' }}
                </v-icon>
                <span class="save-card__label">
                  {{ target === 'remote' ? t('server.worldPreserve') : rawWorldExists ? t('save.useCurrent') : t('save.createNew') }}
                </span>
              </button>
            </v-item>
            <v-item
              v-for="s of saves"
              :key="s.path"
              v-slot="{ isSelected, toggle }"
            >
              <button
                type="button"
                class="save-card"
                :class="{ 'save-card--selected': isSelected }"
                @click="toggle"
              >
                <img
                  v-fallback-img="BuiltinImages.unknownServer"
                  class="save-card__image"
                  :src="s.icon"
                >
                <span class="save-card__label">
                  {{ s.name }}
                </span>
              </button>
            </v-item>
          </div>
        </v-item-group>
      </section>

      <!-- Mods -->
      <section v-if="enabled.length > 0" data-testid="server-mods">
        <div class="server-run__section-header">
          <v-icon
            size="small"
            color="primary"
          >
            extension
          </v-icon>
          <span class="text-subtitle-2 font-weight-medium">
            {{ t('mod.name') }}
          </span>
          <v-chip
            size="x-small"
            variant="tonal"
            label
          >
            {{ selectedMods.length }} / {{ enabled.length }}
          </v-chip>
          <v-btn
            v-if="serverModsLocked"
            color="primary"
            size="small"
            variant="tonal"
            class="ml-2"
            @click="unlockServerMods()"
          >
            <v-icon start>edit</v-icon>
            {{ t('shared.edit') }}
          </v-btn>

          <v-spacer />

          <v-btn
            v-shared-tooltip="() => t('env.select.all')"
            variant="text"
            density="comfortable"
            size="small"
            icon
            :disabled="serverModsLocked"
            @click="selectAll"
          >
            <v-icon>select_all</v-icon>
          </v-btn>
          <v-btn
            v-shared-tooltip="() => t('env.select.fit')"
            variant="text"
            density="comfortable"
            size="small"
            icon
            :disabled="serverModsLocked"
            @click="selectFit"
          >
            <v-icon>tab_unselected</v-icon>
          </v-btn>
          <v-btn
            v-shared-tooltip="() => t('env.select.none')"
            variant="text"
            density="comfortable"
            size="small"
            icon
            :disabled="serverModsLocked"
            @click="selectNone"
          >
            <v-icon>deselect</v-icon>
          </v-btn>
          <v-text-field
            v-model="search"
            class="ml-1 max-w-52"
            density="compact"
            variant="outlined"
            prepend-inner-icon="search"
            :placeholder="t('shared.search')"
            hide-details
            clearable
          />
        </div>

        <v-data-table
          v-model="selectedMods"
          class="server-run__mods rounded-lg"
          :disabled="loadingSelectedMods || serverModsLocked"
          item-value="path"
          return-object
          :show-select="!serverModsLocked"
          :search="search"
          :headers="headers"
          :items="enabled"
          :items-per-page="10"
          density="compact"
        >
          <template #item.name="{ item }">
            <div class="flex items-center gap-2">
              <v-avatar
                :size="28"
                rounded="md"
              >
                <img :src="item.icon || BuiltinImages.unknownServer">
              </v-avatar>
              <span class="text-body-2 truncate">{{ item.name }}</span>
            </div>
          </template>
          <template #item.hash="{ item }">
            <v-chip
              size="x-small"
              label
              variant="tonal"
              :color="sideColor(item)"
            >
              {{ getSide(item) }}
            </v-chip>
          </template>
        </v-data-table>
      </section>

      <section>
        <div class="server-run__section-header">
          <v-icon size="small" color="primary">article</v-icon>
          <span class="text-subtitle-2 font-weight-medium">{{ t('server.log') }}</span>
          <v-chip size="x-small" variant="tonal" :color="isTargetRunning ? 'success' : undefined">
            {{ isTargetRunning ? t('baseSetting.info.running') : t('baseSetting.info.stopped') }}
          </v-chip>
          <v-spacer />
          <v-btn icon size="small" variant="text" :aria-label="t('server.clearLog')" @click="clearTargetLog">
            <v-icon size="18">delete_sweep</v-icon>
          </v-btn>
        </div>
        <div ref="localLogViewer" class="server-run__log" :data-testid="target === 'remote' ? 'server-remote-log' : 'server-local-log'">
          <div v-if="targetLogLines.length === 0" class="opacity-50">{{ t('server.logWaiting') }}</div>
          <div v-for="(line, index) in targetLogLines" :key="index">{{ line }}</div>
        </div>
      </section>
    </div>
  </SettingCard>
</template>
<script lang="ts" setup>
import SettingCard from '@/components/SettingCard.vue'
import { useRefreshable } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kInstanceSave } from '@/composables/instanceSave'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { useInstanceVersionServerInstall } from '@/composables/instanceVersionServerInstall'
import { kInstanceServerLaunch } from '@/composables/instanceServerLaunch'
import { kRemoteServer } from '@/composables/remoteServer'
import { useLaunchException } from '@/composables/launchException'
import { useService } from '@/composables/service'
import { useGamepadAction, vibrateGamepad } from '@/composables/gamepad'
import { BuiltinImages } from '@/constant'
import { vFallbackImg } from '@/directives/fallbackImage'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { ModFile, getModSide } from '@/util/mod'
import { Project } from '@xmcl/modrinth'
import type { InstanceServerConfig } from '@xmcl/instance'
import { InstanceLogServiceKey, InstanceModsServiceKey, InstanceOptionsServiceKey, InstanceSavesServiceKey, InstanceServiceKey, LaunchServiceKey, ServerServiceKey, type ServerServiceStatus } from '@xmcl/runtime-api'
import { useDebounceFn } from '@vueuse/core'

const { target } = defineProps<{ target: 'local' | 'remote' }>()
const remote = injection(kRemoteServer)

const port = ref(25565)
const motd = ref('')
const maxPlayers = ref(20)
const onlineMode = ref(false)
const isAcceptEula = ref(false)
const nogui = ref(false)
const linkedWorld = ref('')
const worldMode = ref<'create' | 'instance' | 'preserve'>('create')
const rawWorldExists = ref(false)
const { getEULA, setEULA, getServerProperties, setServerProperties } = useService(InstanceOptionsServiceKey)
const { linkSaveAsServerWorld, getLinkedSaveWorld } = useService(InstanceSavesServiceKey)

function parseServerProperties(content: string) {
  return Object.fromEntries(content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('=')
      return separator === -1 ? [line, ''] : [line.slice(0, separator), line.slice(separator + 1)]
    }))
}

function stringifyServerProperties(properties: Record<string, string | number | boolean>) {
  return Object.entries(properties).map(([key, value]) => `${key}=${value}`).join('\n') + '\n'
}

const { launch, kill, serverCount, gameProcesses } = injection(kInstanceLaunch)
const { serverVersionId } = injection(kInstanceVersion)
const { runtime, path, instance } = injection(kInstance)
const { editInstance } = useService(InstanceServiceKey)
const { saves, revalidate } = injection(kInstanceSave)
const { mods } = injection(kInstanceModsContext)
const enabled = computed(() => mods.value.filter(m => m.enabled))

const isServerRunning = computed(() => serverCount.value > 0)
const localServiceEnabled = computed(() => target === 'local' && instance.value.serverConfig?.service.enabled === true)
const localServiceStatus = ref<ServerServiceStatus>()
const serverService = useService(ServerServiceKey)
const isTargetRunning = computed(() => target === 'remote'
  ? !!remote.status.value?.serviceActive
  : localServiceEnabled.value ? !!localServiceStatus.value?.active : isServerRunning.value)
const targetLogLines = computed(() => target === 'remote' ? remote.logLines.value : localLogLines.value)
async function refreshLocalServiceStatus() {
  if (target === 'local') localServiceStatus.value = await serverService.getStatus(path.value, 'local')
}
async function onKill() {
  if (target === 'remote') {
    remote.stopService().then(() => remote.refreshStatus())
  } else if (localServiceEnabled.value) {
    const result = await serverService.stop(path.value, 'local')
    if (!result.ok) throw new Error(result.message || 'Failed to stop Windows service.')
    await refreshLocalServiceStatus()
  } else {
    kill('server')
  }
}

function clearTargetLog() {
  if (target === 'local') localLogLines.value = []
}

const localLogLines = ref<string[]>([])
const localLogViewer = ref<HTMLElement>()
const serverPids = new Set<number>()
const logRemainders = new Map<number, string>()
const launchService = useService(LaunchServiceKey)
const { getServerLogContent } = useService(InstanceLogServiceKey)

function appendLocalLog(pid: number, output: string) {
  if (!serverPids.has(pid)) return
  const chunks = (logRemainders.get(pid) ?? '').concat(output).replaceAll('\r', '').split('\n')
  logRemainders.set(pid, chunks.pop() ?? '')
  if (chunks.length > 0) {
    localLogLines.value = localLogLines.value.concat(chunks).slice(-2000)
  }
}

function onServerStart(event: { pid: number; side?: 'client' | 'server'; gameDirectory: string }) {
  if (event.side !== 'server' || event.gameDirectory !== path.value) return
  serverPids.add(event.pid)
  localLogLines.value = []
}

function onServerStdout(event: { pid: number; stdout: string }) {
  appendLocalLog(event.pid, event.stdout)
}

function onServerStderr(event: { pid: number; stderr: string }) {
  appendLocalLog(event.pid, event.stderr)
}

function onServerExit(event: { pid: number; code?: number; signal?: string }) {
  if (!serverPids.delete(event.pid)) return
  const remainder = logRemainders.get(event.pid)
  if (remainder) localLogLines.value = localLogLines.value.concat(remainder)
  logRemainders.delete(event.pid)
  localLogLines.value.push(`[XMCL] Server process exited (${event.code ?? event.signal ?? 'unknown'}).`)
}

async function loadLocalLog() {
  const instancePath = path.value
  const content = await getServerLogContent(instancePath, 'latest.log').catch(() => '')
  if (instancePath === path.value && localLogLines.value.length === 0 && content) {
    localLogLines.value = content.replaceAll('\r', '').split('\n').slice(-2000)
  }
}

watch(() => targetLogLines.value.length, () => {
  nextTick(() => {
    if (localLogViewer.value) localLogViewer.value.scrollTop = localLogViewer.value.scrollHeight
  })
})

// Draw attention to the EULA checkbox (shake + highlight) when the user tries
// to launch without accepting it — instead of disabling the launch button.
const eulaBox = ref<HTMLElement | null>(null)
const eulaShake = ref(false)
let shakeTimer: ReturnType<typeof setTimeout> | undefined
function triggerEulaShake() {
  eulaBox.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  eulaShake.value = false
  clearTimeout(shakeTimer)
  vibrateGamepad()
  requestAnimationFrame(() => {
    eulaShake.value = true
    shakeTimer = setTimeout(() => { eulaShake.value = false }, 600)
  })
}

// Bridge to the header action button (BaseSettingExtension).
const serverLaunch = injection(kInstanceServerLaunch)
if (target === 'local') {
  serverLaunch.setHandlers({
    launch: async () => {
      if (!isAcceptEula.value) {
        triggerEulaShake()
        return
      }
      if (!localServiceEnabled.value) return onPlay()
      await prepareServer()
      const result = await serverService.start(path.value, 'local')
      if (!result.ok) throw new Error(result.message || 'Failed to start Windows service.')
      await refreshLocalServiceStatus()
    },
    kill: onKill,
  })
}
watch(isTargetRunning, (v) => { serverLaunch.running.value = v }, { immediate: true })
watch(() => isAcceptEula.value, (v) => {
  serverLaunch.canLaunch.value = target === 'local' ? v : v && remote.configured.value
}, { immediate: true })
watch(port, (value) => { serverLaunch.port.value = value }, { immediate: true })
watch(maxPlayers, (value) => { serverLaunch.maxPlayers.value = value }, { immediate: true })
onMounted(() => {
  serverLaunch.active.value = true
  if (target === 'remote' && remote.configured.value) remote.watchingLog.value = true
  if (target === 'remote') return
  refreshLocalServiceStatus()
  for (const process of gameProcesses.value) {
    if (process.side === 'server') serverPids.add(process.pid)
  }
  launchService.on('minecraft-start', onServerStart)
  launchService.on('minecraft-stdout', onServerStdout)
  launchService.on('minecraft-stderr', onServerStderr)
  launchService.on('minecraft-exit', onServerExit)
  loadLocalLog()
})
let serviceStatusTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (target === 'local') serviceStatusTimer = setInterval(refreshLocalServiceStatus, 3_000)
})
onBeforeUnmount(() => {
  serverLaunch.setPreparationHandlers({})
  if (target === 'local') {
    serverLaunch.active.value = false
    serverLaunch.setHandlers({})
  }
  if (target === 'remote') return
  if (serviceStatusTimer) clearInterval(serviceStatusTimer)
  launchService.removeListener('minecraft-start', onServerStart)
  launchService.removeListener('minecraft-stdout', onServerStdout)
  launchService.removeListener('minecraft-stderr', onServerStderr)
  launchService.removeListener('minecraft-exit', onServerExit)
})

const selectedSave = computed({
  get() {
    if (worldMode.value !== 'instance') return 0
    const i = saves.value.findIndex(s => s.path === linkedWorld.value)
    return i + 1
  },
  set(v) {
    if (v === 0) {
      worldMode.value = target === 'remote' ? 'preserve' : 'create'
      linkedWorld.value = ''
      return
    }
    worldMode.value = 'instance'
    linkedWorld.value = saves.value[v - 1]?.path ?? ''
  },
})

function applyDesiredConfig(config: InstanceServerConfig) {
  isAcceptEula.value = config.eula
  motd.value = config.motd
  port.value = config.port
  maxPlayers.value = config.maxPlayers
  onlineMode.value = config.onlineMode
  nogui.value = config.nogui
  worldMode.value = config.world.mode
  linkedWorld.value = config.world.saveName ?? ''
}

async function refresh() {
  const desired = instance.value.serverConfig
  const linked = await getLinkedSaveWorld(path.value)
  rawWorldExists.value = linked !== undefined && linked !== ''
  if (desired) {
    applyDesiredConfig(desired)
    return
  }
  const [properties, eula] = await Promise.all([
    getServerProperties(path.value),
    getEULA(path.value),
  ])
  const p = properties
  const parsedPort = parseInt(p.port, 10)
  port.value = isNaN(parsedPort) ? 25565 : parsedPort
  motd.value = p.motd || 'A Minecraft Server'
  const parsedMaxPlayers = parseInt(p['max-players'], 10)
  maxPlayers.value = isNaN(parsedMaxPlayers) ? 20 : parsedMaxPlayers
  onlineMode.value = p['online-mode'] === 'true'
  isAcceptEula.value = eula
  if (linked && saves.value.some(save => save.path === linked)) {
    worldMode.value = 'instance'
    linkedWorld.value = linked
  } else {
    worldMode.value = 'create'
    linkedWorld.value = ''
  }
}

let lastPath = ''
const initialized = ref(false)
async function init() {
  if (lastPath === path.value) {
    serverModsLocked.value = serverModsDetected.value
    return
  }
  initialized.value = false
  lastPath = path.value
  revalidate()
  await refresh()
  loadingSelectedMods.value = true
  selectNone()
  // Check the server mods folder. If multiple files exist, mark as detected and optionally lock the mods list.
  await getServerInstanceMods(path.value).then((mods) => {
    const all = enabled.value
    serverModsDetected.value = mods.length > 0
    const desiredMods = instance.value.serverConfig?.mods
    if (desiredMods) {
      selectedMods.value = all.filter(mod => desiredMods.includes(mod.path))
      serverModsLocked.value = false
    } else if (mods.length > 1) {
      serverModsLocked.value = true
      if (mods.length > 0) {
        selectedMods.value = all.filter(m => mods.some(a => a.ino === m.ino))
      } else {
        selectedMods.value = getFitsMods()
      }
    } else {
      serverModsLocked.value = false
      if (mods.length > 0) {
        selectedMods.value = all.filter(m => mods.some(a => a.ino === m.ino))
      } else {
        selectedMods.value = getFitsMods()
      }
    }
  }).finally(() => {
    loadingSelectedMods.value = false
  })
  initialized.value = true
  if (!instance.value.serverConfig) await persistDesiredConfiguration()
}
onMounted(init)
watch(() => path.value, init)

const { t } = useI18n()

const search = ref('')
const modLoader = computed(() => runtime.value.forge ? 'forge' : runtime.value.fabricLoader ? 'fabric'
  : runtime.value.quiltLoader ? 'quilt' : runtime.value.neoForged ? 'neoforge' : '')

const computedSides = computed(() => {
  const ml = modLoader.value
  if (!ml) return {}
  const files = enabled.value
  const result = Object.fromEntries(files.map(f => [f.hash, getModSide(f, ml)] as const))
  return result
})

const requestedSides: Ref<Record<string, string>> = shallowRef({})
watch([enabled], async () => {
  const [modrinths, others] = enabled.value.reduce((acc, v) => {
    if (v.modrinth) {
      acc[0].push(v)
    } else {
      acc[1].push(v)
    }
    return acc
  }, [[], []] as [ModFile[], ModFile[]])

  const hashes = others.map(v => v.hash)
  const dict = hashes.length > 0 ? await clientModrinthV2.getProjectVersionsByHash(hashes) : {}
  const hashToProjId = Object.fromEntries(Object.entries(dict).map(([hash, v]) => [hash, v.project_id]))
  const projIds = modrinths.map(v => v.modrinth!.projectId).concat(Object.values(hashToProjId))

  const allProjects = projIds.length > 0 ? await clientModrinthV2.getProjects(projIds) : []
  const allProjectsDict = Object.fromEntries(allProjects.map(v => [v.id, v]))

  const getSideFromProject = (p?: Project) => {
    if (!p) return ''
    if (p.client_side === 'unsupported') return 'SERVER'
    if (p.server_side === 'unsupported') return 'CLIENT'
    return 'BOTH'
  }

  const hashToSide = Object.fromEntries(enabled.value.map(v => [
    v.hash,
    v.modrinth
      ? getSideFromProject(allProjectsDict[v.modrinth.projectId])
      : hashToProjId[v.hash]
        ? getSideFromProject(allProjectsDict[hashToProjId[v.hash]])
        : ''
  ]))

  requestedSides.value = hashToSide
}, { immediate: true })


const sides = computed(() => {
  const computedMap = computedSides.value
  const requested = requestedSides.value || {}
  const result = Object.fromEntries(Object.keys(computedMap).map(k => [k, requested[k] || computedMap[k]] as const))
  return result
})

function getSide(mod: ModFile) {
  const side = sides.value[mod.hash]
  if (!side) return '?'
  if (side === 'CLIENT') return t('shared.client')
  if (side === 'SERVER') return t('shared.client') + '/' + t('shared.server')
  return t('shared.client') + '/' + t('shared.server')
}

function sideColor(mod: ModFile) {
  const side = sides.value[mod.hash]
  if (side === 'CLIENT') return 'orange'
  if (side === 'SERVER') return 'primary'
  if (side === 'BOTH') return 'primary'
  return undefined
}

const sortIndex = markRaw({
  CLIENT: 0,
  BOTH: 1,
  SERVER: 2,
  '': 3,
}) as Record<string, number>

const headers = computed(() => [
  {
    text: t('mod.name'),
    value: 'name',
  },
  {
    text: t('modrinth.environments.name'),
    value: 'hash',
    sort: (a: string, b: string) => {
      const sideA = sortIndex[(sides.value[a])]
      const sideB = sortIndex[(sides.value[b])]
      return sideA - sideB
    }
  },
])

const loadingSelectedMods = ref(false)
const selectedMods = shallowRef<ModFile[]>([])

const serverModsLocked = ref(false)
const serverModsDetected = ref(false)

function unlockServerMods() {
  loadingSelectedMods.value = true
  getServerInstanceMods(path.value).then((mods) => {
    const all = enabled.value
    if (mods.length > 0) {
      selectedMods.value = all.filter(m => mods.some(a => a.ino === m.ino))
    } else {
      selectedMods.value = getFitsMods()
    }
    serverModsLocked.value = false
  }).finally(() => {
    loadingSelectedMods.value = false
  })
}

const { installToServerInstance, getServerInstanceMods } = useService(InstanceModsServiceKey)

function getFitsMods() {
  return enabled.value.filter(v => {
    const side = sides.value[v.hash]
    if (side === 'CLIENT') return false
    return true
  })
}

function selectFit() {
  selectedMods.value = getFitsMods()
}

function selectAll() {
  selectedMods.value = enabled.value
}

function selectNone() {
  selectedMods.value = []
}

const { install } = useInstanceVersionServerInstall()

const errorTitle = ref('')
const errorDescription = ref('')
const errorUnexpected = ref(false)
const errorExtraText = ref('')
const { onError } = useLaunchException(
  errorTitle,
  errorDescription,
  errorUnexpected,
  errorExtraText
)

const { refresh: onPlay, refreshing: loading, error } = useRefreshable(async () => {
  const version = await prepareServer()
  await launch('server', { nogui: nogui.value, version })
})

function getDesiredConfiguration(): InstanceServerConfig {
  const serviceName = instance.value.serverConfig?.service.name || `xmcl-${instance.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'server'}`
  return {
    eula: isAcceptEula.value,
    motd: motd.value || 'A Minecraft Server',
    port: port.value || 25565,
    maxPlayers: maxPlayers.value || 20,
    onlineMode: onlineMode.value,
    nogui: nogui.value,
    world: {
      mode: worldMode.value,
      saveName: worldMode.value === 'instance' ? linkedWorld.value : undefined,
    },
    mods: selectedMods.value.map(mod => mod.path),
    deployment: instance.value.serverConfig?.deployment ?? {
      config: { policy: 'mirror' },
      mods: { policy: 'mirror' },
      world: { policy: 'initialize' },
      extra: { policy: 'overlay' },
    },
    service: {
      enabled: instance.value.serverConfig?.service.enabled ?? false,
      name: serviceName,
      startCommand: target === 'remote'
        ? instance.value.serverConfig?.service.startCommand || '/bin/sh server.sh'
        : undefined,
    },
  }
}

async function persistDesiredConfiguration() {
  await editInstance({
    instancePath: path.value,
    serverConfig: getDesiredConfiguration(),
  })
}

const persistDesiredConfigurationDebounced = useDebounceFn(persistDesiredConfiguration, 300)
watch([
  isAcceptEula,
  motd,
  port,
  maxPlayers,
  onlineMode,
  nogui,
  worldMode,
  linkedWorld,
  selectedMods,
], () => {
  if (initialized.value) persistDesiredConfigurationDebounced()
}, { deep: true })

async function applyLocalConfiguration() {
  const instPath = path.value
  const _maxPlayers = maxPlayers.value
  const _port = port.value
  const _motd = motd.value
  const _onlineMode = onlineMode.value

  await persistDesiredConfiguration()
  await setEULA(instPath, isAcceptEula.value)
  await setServerProperties(instPath, {
    port: _port ?? 25565,
    motd: _motd || 'A Minecraft Server',
    'max-players': _maxPlayers ?? 20,
    'online-mode': _onlineMode ?? false,
  })
}

async function applyConfiguration() {
  if (target !== 'remote') return
  const original = parseServerProperties(await remote.readRemoteFile('server.properties'))
  await remote.writeRemoteFile('eula.txt', `#By agreeing to the Minecraft EULA.\neula=${isAcceptEula.value}\n`)
  await remote.writeRemoteFile('server.properties', stringifyServerProperties({
    ...original,
    port: port.value ?? 25565,
    motd: motd.value || 'A Minecraft Server',
    'max-players': maxPlayers.value ?? 20,
    'online-mode': onlineMode.value ?? false,
  }))
}

async function prepareServer() {
  const instPath = path.value
  const _mods = selectedMods.value

  await applyLocalConfiguration()

  const version = await install()

  if (worldMode.value === 'instance' && linkedWorld.value) {
    await linkSaveAsServerWorld({
      instancePath: instPath,
      saveName: linkedWorld.value,
    })
  }
  if (!serverModsLocked.value) {
    await installToServerInstance({
      path: instPath,
      files: _mods.map(v => v.path),
    })
  }

  return version
}

serverLaunch.setPreparationHandlers({ prepare: prepareServer, applyConfiguration })

watch(error, (e) => {
  if (e) {
    onError(e)
  }
})

// Gamepad X on the server tab launches (or stops) the local server.
useGamepadAction('X', {
  label: () => isServerRunning.value ? t('server.stop') : t('server.launch'),
  handler: () => {
    if (isServerRunning.value) {
      onKill()
      return
    }
    if (!isAcceptEula.value) {
      triggerEulaShake()
      return
    }
    onPlay()
  },
})
</script>

<style scoped>
.server-run__section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 10px;
}

.server-run__log {
  height: 280px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.22);
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

/* EULA attention shake + highlight when launching without acceptance. */
.eula-box {
  transition: background-color 0.3s ease;
}

.eula-box--alert {
  background-color: rgba(var(--v-theme-error), 0.14);
  animation: eula-shake 0.5s ease-in-out;
}

@keyframes eula-shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-8px); }
  30% { transform: translateX(8px); }
  45% { transform: translateX(-6px); }
  60% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
  90% { transform: translateX(3px); }
}

/* Save selection cards */
.save-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 110px;
  padding: 8px;
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    transform 0.15s ease;
}

.save-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
  background-color: rgba(var(--v-theme-primary), 0.04);
}

.save-card--selected {
  border-color: rgb(var(--v-theme-primary));
  background-color: rgba(var(--v-theme-primary), 0.08);
}

.save-card__image {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border-radius: 8px;
}

.save-card__label {
  font-size: 0.8125rem;
  text-align: center;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 4px;
}

/* Mod table */
.server-run__mods :deep(.v-data-table__th) {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.server-run__mods :deep(tbody tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.04);
}
</style>
