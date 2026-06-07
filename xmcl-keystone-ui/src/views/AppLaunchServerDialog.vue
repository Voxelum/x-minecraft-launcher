<template>
  <v-dialog
    v-model="isShown"
    width="820"
    scrollable
  >
    <v-card class="launch-server-dialog select-none flex flex-col overflow-hidden">
      <!-- Header -->
      <v-card-item class="launch-server-dialog__header">
        <template #prepend>
          <v-avatar
            color="primary"
            variant="tonal"
            size="44"
            rounded="lg"
          >
            <v-icon size="24">dns</v-icon>
          </v-avatar>
        </template>
        <v-card-title class="text-h6 font-weight-medium">
          {{ t('instance.launchServer') }}
        </v-card-title>
        <v-card-subtitle class="pt-0">
          {{ runtime.minecraft }}
          <template v-if="runtime.forge">· Forge {{ runtime.forge }}</template>
          <template v-else-if="runtime.neoForged">· NeoForge {{ runtime.neoForged }}</template>
          <template v-else-if="runtime.fabricLoader">· Fabric {{ runtime.fabricLoader }}</template>
          <template v-else-if="runtime.quiltLoader">· Quilt {{ runtime.quiltLoader }}</template>
        </v-card-subtitle>
        <template #append>
          <v-btn
            v-shared-tooltip="() => t('shared.cancel')"
            class="non-moveable"
            icon
            variant="text"
            density="comfortable"
            @click="isShown = false"
          >
            <v-icon>close</v-icon>
          </v-btn>
        </template>
      </v-card-item>

      <v-divider />

      <!-- Body -->
      <v-card-text
        class="launch-server-dialog__body visible-scroll flex flex-col gap-5 max-h-[62vh] overflow-y-auto overflow-x-hidden px-6 py-5"
      >
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

        <!-- Server settings -->
        <section>
          <div class="launch-server-dialog__section-header">
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
        <section>
          <div class="launch-server-dialog__section-header">
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
                    {{ rawWorldExists ? t('save.useCurrent') : t('save.createNew') }}
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
        <section v-if="enabled.length > 0">
          <div class="launch-server-dialog__section-header">
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
            class="launch-server-dialog__mods rounded-lg"
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
      </v-card-text>

      <v-divider />

      <!-- Footer -->
      <div class="launch-server-dialog__footer flex items-center gap-3 px-6 py-3">
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

        <v-spacer />

        <v-btn
          variant="text"
          @click="isShown = false"
        >
          {{ t('shared.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          rounded="pill"
          prepend-icon="play_arrow"
          :disabled="!isAcceptEula"
          :loading="loading"
          @click="onPlay"
        >
          {{ t('instance.launchServer') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>
<script lang="ts" setup>
import { useRefreshable } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kInstanceSave } from '@/composables/instanceSave'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { useInstanceVersionServerInstall } from '@/composables/instanceVersionServerInstall'
import { useLaunchException } from '@/composables/launchException'
import { useService } from '@/composables/service'
import { BuiltinImages } from '@/constant'
import { vFallbackImg } from '@/directives/fallbackImage'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { ModFile, getModSide } from '@/util/mod'
import { Project } from '@xmcl/modrinth'
import { InstanceModsServiceKey, InstanceOptionsServiceKey, InstanceSavesServiceKey } from '@xmcl/runtime-api'

defineProps<{}>()

const port = ref(25565)
const motd = ref('')
const maxPlayers = ref(20)
const onlineMode = ref(false)
const isAcceptEula = ref(false)
const nogui = ref(false)
const linkedWorld = ref('')
const rawWorldExists = ref(false)
const { getEULA, setEULA, getServerProperties, setServerProperties } = useService(InstanceOptionsServiceKey)
const { linkSaveAsServerWorld, getLinkedSaveWorld } = useService(InstanceSavesServiceKey)

let _eula: boolean

const { launch, gameProcesses } = injection(kInstanceLaunch)
const { serverVersionId } = injection(kInstanceVersion)

const selectedSave = computed({
  get() {
    if (linkedWorld.value === '') return 0
    const i = saves.value.findIndex(s => s.path === linkedWorld.value)
    return i + 1
  },
  set(v) {
    if (v === 0) {
      linkedWorld.value = ''
      return
    }
    linkedWorld.value = saves.value[v - 1]?.path ?? ''
  },
})

function refresh() {
  getLinkedSaveWorld(path.value).then((v) => {
    rawWorldExists.value = v !== undefined && v !== ''
    linkedWorld.value = v ?? ''
  })
  getServerProperties(path.value).then((p) => {
    const parsedPort = parseInt(p.port, 10)
    port.value = isNaN(parsedPort) ? 25565 : parsedPort
    motd.value = p.motd || 'A Minecraft Server'
    const parsedMaxPlayers = parseInt(p.maxPlayers, 10)
    maxPlayers.value = isNaN(parsedMaxPlayers) ? 20 : parsedMaxPlayers
    onlineMode.value = Boolean(p.onlineMode)
  })
  getEULA(path.value).then((v) => {
    isAcceptEula.value = v
    _eula = v
  })
}

let lastPath = ''
const { isShown } = useDialog('launch-server', () => {
  if (lastPath === path.value) {
    serverModsLocked.value = serverModsDetected.value
    return
  }
  lastPath = path.value
  revalidate()
  refresh()
  loadingSelectedMods.value = true
  selectNone()
  // Check the server mods folder. If multiple files exist, mark as detected and optionally lock the mods list.
  getServerInstanceMods(path.value).then((mods) => {
    const all = enabled.value
    serverModsDetected.value = mods.length > 0
    if (mods.length > 1) {
      // when multiple server mods exist, show them but keep UI locked until user unlocks
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
})
const { t } = useI18n()

const { runtime, path } = injection(kInstance)
const { saves, revalidate } = injection(kInstanceSave)
const { mods } = injection(kInstanceModsContext)
const enabled = computed(() => mods.value.filter(m => m.enabled))
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
watch([enabled, isShown], async () => {
  if (!isShown.value) {
    requestedSides.value = {}
    return
  }
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
})


const sides = computed(() => {
  // join computedSides and requestedSides
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

// New: when a server instance already contains multiple mod files, we don't auto-refresh the mod list.
const serverModsLocked = ref(false)
const serverModsDetected = ref(false)

function unlockServerMods() {
  loadingSelectedMods.value = true
  // unlock editing, refresh mapping from server to selections
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
  const runtimeValue = runtime.value
  const instPath = path.value
  let version = serverVersionId.value
  const _maxPlayers = maxPlayers.value
  const _port = port.value
  const _motd = motd.value
  const _onlineMode = onlineMode.value
  const _nogui = nogui.value
  const _mods = selectedMods.value

  if (!_eula) {
    console.log('eula')
    await setEULA(instPath, true)
  }
  console.log('serverProperties')
  await setServerProperties(instPath, {
    port: _port ?? 25565,
    motd: _motd || 'A Minecraft Server',
    'max-players': _maxPlayers ?? 20,
    'online-mode': _onlineMode ?? false,
  })

  version = await install()

  if (linkedWorld.value) {
    console.log('linkSaveAsServerWorld', linkedWorld.value)
    await linkSaveAsServerWorld({
      instancePath: instPath,
      saveName: linkedWorld.value,
    })
  }
  console.log('installToServerInstance')
  // If server mods are locked (existing mods in server folder), do not deploy/overwrite server mods.
  if (!serverModsLocked.value) {
    await installToServerInstance({
      path: instPath,
      files: _mods.map(v => v.path),
    })
  } else {
    console.log('server mods locked, skipping deploying mods to server instance')
  }
  console.log('launch')

  await launch('server', { nogui: _nogui, version })

  isShown.value = false
})

watch(error, (e) => {
  if (e) {
    onError(e)
  }
})

</script>

<style scoped>
.launch-server-dialog__header {
  padding: 16px 16px 12px 20px;
}

.launch-server-dialog__body {
  background-color: rgba(var(--v-theme-on-surface), 0.015);
}

.launch-server-dialog__section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 10px;
}

.launch-server-dialog__footer {
  background-color: rgba(var(--v-theme-on-surface), 0.02);
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
.launch-server-dialog__mods :deep(.v-data-table__th) {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.launch-server-dialog__mods :deep(tbody tr:hover) {
  background-color: rgba(var(--v-theme-primary), 0.04);
}
</style>
