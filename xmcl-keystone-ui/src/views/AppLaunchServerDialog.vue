<template>
  <v-dialog v-model="isShown" width="800">
    <v-card class="select-none overflow-auto flex flex-col">
      <v-toolbar class="flex-1 flex-grow-0 rounded-none" tabs color="green en">
        <v-toolbar-title class="text-white">
          {{ t('instance.launchServer') }}
        </v-toolbar-title>

        <v-spacer />
        <v-btn class="non-moveable" icon @click="isShown = false">
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <div class="visible-scroll flex flex-col max-h-[60vh] mx-0 overflow-y-auto overflow-x-hidden px-6 py-2">
        <v-alert v-if="error" type="error" class="select-text">
          {{ errorTitle }}
          <br />
          <div v-html="errorDescription">
          </div>
        </v-alert>
        <v-subheader>{{ t('baseSetting.title') }}</v-subheader>
        <div class="grid grid-cols-3 gap-3 pt-2 px-2">
          <v-text-field v-model="motd" :label="t('server.motd')" outlined hide-details />
          <v-text-field v-model="port" :label="t('server.port')" outlined type="number" hide-details />
          <v-text-field v-model="maxPlayers" :label="t('server.maxPlayers')" outlined type="number" hide-details />
          <v-checkbox v-model="nogui" class="col-start-1" :label="t('server.nogui')" />
          <v-checkbox v-model="onlineMode" class="col-start-3" :label="t('server.onlineMode')" />
        </div>
        <v-subheader>{{ t('save.name') }}</v-subheader>
        <v-item-group v-model="selectedSave" mandatory class="pt-2 px-2">
          <div class="grid grid-cols-3 gap-2 max-h-40 overflow-auto">
            <v-item v-slot="{ active, toggle }">
              <v-card :color="active ? 'primary' : ''" class="flex flex-col items-center justify-center h-[120px] gap-1"
                @click="toggle">
                <v-icon size="80">
                  {{ rawWorldExists ? 'save' : 'add' }}
                </v-icon>
                {{ rawWorldExists ? t('save.useCurrent') : t('save.createNew') }}
              </v-card>
            </v-item>
            <v-item v-for="s of saves" :key="s.path" v-slot="{ active, toggle }">
              <v-card :color="active ? 'primary' : ''" class="flex flex-col items-center justify-center gap-1"
                @click="toggle">
                <img v-fallback-img="BuiltinImages.unknownServer" class="rounded-lg object-contain" :src="s.icon"
                  width="80px" height="80px">
                {{ s.name }}
              </v-card>
            </v-item>
          </div>
        </v-item-group>

        <template v-if="enabled.length > 0">
          <div class="flex items-center mt-4 gap-2">
            <v-subheader class="">
              {{ t('mod.name') }}
            </v-subheader>
            <div class="flex-grow" />
            <v-btn v-shared-tooltip="_ => t('env.select.all')" text icon @click="selectAll">
              <v-icon>
                select_all
              </v-icon>
            </v-btn>
            <v-btn v-shared-tooltip="_ => t('env.select.fit')" text icon @click="selectFit">
              <v-icon>
                tab_unselected
              </v-icon>
            </v-btn>

            <v-btn v-shared-tooltip="_ => t('env.select.none')" text icon @click="selectNone">
              <v-icon>
                deselect
              </v-icon>
            </v-btn>
            <v-text-field v-model="search" class="max-w-50 pl-1" dense outlined flat prepend-inner-icon="search"
              hide-details />
          </div>
          <div class="pt-2 px-2">
            <v-data-table v-model="selectedMods" :disabled="loadingSelectedMods" item-key="path" show-select
              :search="search" :headers="headers" :items="enabled">
              <template #item.name="{ item }">
                <!-- <v-chip
                  :color="getColor(item.calories)"
                  dark
                >
                  {{ item.calories }}
                </v-chip> -->
                <v-list-item-avatar :size="30">
                  <img :src="item.icon || BuiltinImages.unknownServer">
                </v-list-item-avatar>

                {{ item.name }}
              </template>
              <template #item.hash="{ item }">
                {{ getSide(item) }}
              </template>
              <!-- <template #top>
                <v-switch
                  v-model="singleSelect"
                  label="Single select"
                  class="pa-3"
                />
              </template> -->
            </v-data-table>
          </div>
        </template>

        <div class="flex items-center pt-2 px-2">
          <v-checkbox v-model="isAcceptEula">
            <template #label>
              <i18n-t keypath="eula.body" tag="span">
                <template #eula>
                  <a href="https://aka.ms/MinecraftEULA" target="_blank" @click.stop>EULA</a>
                </template>
              </i18n-t>
            </template>
          </v-checkbox>
        </div>
      </div>
      <v-divider />
      <div class="flex p-4">
        <div class="flex-grow" />
        <v-btn color="primary" :disabled="!isAcceptEula" :loading="loading" @click="onPlay">
          <v-icon>
            play_arrow
          </v-icon>
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
import { getModrinthVersionModel } from '@/composables/modrinthVersions'
import { useService } from '@/composables/service'
import { BuiltinImages } from '@/constant'
import { vFallbackImg } from '@/directives/fallbackImage'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { ModFile, getModSide } from '@/util/mod'
import { Project } from '@xmcl/modrinth'
import { InstanceModsServiceKey, InstanceOptionsServiceKey, InstanceSavesServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'

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
    return
  }
  lastPath = path.value
  revalidate()
  refresh()
  loadingSelectedMods.value = true
  selectNone()
  getServerInstanceMods(path.value).then((mods) => {
    const all = enabled.value
    if (mods.length > 0) {
      selectedMods.value = all.filter(m => mods.some(a => a.ino === m.ino))
    } else {
      selectedMods.value = getFitsMods()
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
  const computed = computedSides.value
  const requested = requestedSides.value || {}
  const result = Object.fromEntries(Object.keys(computed).map(k => [k, requested[k] || computed[k]] as const))
  return result
})


function getSide(mod: ModFile) {
  const side = sides.value[mod.hash]
  if (!side) return '?'
  if (side === 'CLIENT') return t('modrinth.environments.client')
  if (side === 'SERVER') return t('modrinth.environments.server')
  return t('modrinth.environments.client') + '/' + t('modrinth.environments.server')
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
  await installToServerInstance({
    path: instPath,
    mods: _mods.map(v => v.path),
  })
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
