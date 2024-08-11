<template>
  <v-dialog
    v-model="isShown"
    width="800"
  >
    <v-card class="select-none overflow-auto flex flex-col">
      <v-toolbar
        class="flex-1 flex-grow-0 rounded-none"
        tabs
        color="green en"
      >
        <v-toolbar-title class="text-white">
          {{ t('instance.launchServer') }}
        </v-toolbar-title>

        <v-spacer />
        <v-btn
          class="non-moveable"
          icon
          @click="isShown = false"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <div
        class="visible-scroll flex flex-col max-h-[60vh] mx-0 overflow-y-auto overflow-x-hidden px-6 py-2"
      >
        <v-alert
          v-if="error"
          type="error"
          class="select-text"
        >
          {{ error }}
        </v-alert>
        <v-subheader>{{ t('baseSetting.title') }}</v-subheader>
        <div class="grid grid-cols-3 gap-3 pt-2 px-2">
          <v-text-field
            v-model="motd"
            :label="t('server.motd')"
            outlined
            hide-details
          />
          <v-text-field
            v-model="port"
            :label="t('server.port')"
            outlined
            type="number"
            hide-details
          />
          <v-text-field
            v-model="maxPlayers"
            :label="t('server.maxPlayers')"
            outlined
            type="number"
            hide-details
          />
          <v-checkbox
            v-model="nogui"
            class="col-start-1"
            :label="t('server.nogui')"
          />
          <v-checkbox
            v-model="onlineMode"
            class="col-start-3"
            :label="t('server.onlineMode')"
          />
        </div>
        <v-subheader>{{ t('save.name') }}</v-subheader>
        <v-item-group
          v-model="selectedSave"
          mandatory
          class="pt-2 px-2"
        >
          <div class="grid grid-cols-3 gap-2 max-h-40 overflow-auto">
            <v-item v-slot="{ active, toggle }">
              <v-card
                :color="active ? 'primary' : ''"
                class="flex flex-col items-center justify-center h-[120px] gap-1"
                @click="toggle"
              >
                <v-icon size="80">
                  add
                </v-icon>
                {{ t('save.createNew') }}
              </v-card>
            </v-item>
            <v-item
              v-for="s of saves"
              :key="s.path"
              v-slot="{ active, toggle }"
            >
              <v-card
                :color="active ? 'primary' : ''"
                class="flex flex-col items-center justify-center gap-1"
                @click="toggle"
              >
                <img
                  v-fallback-img="BuiltinImages.unknownServer"
                  class="rounded-lg object-contain"
                  :src="s.icon"
                  width="80px"
                  height="80px"
                >
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
            <v-btn
              v-shared-tooltip="_ => t('env.select.all')"
              text
              icon
              @click="selectAll"
            >
              <v-icon>
                select_all
              </v-icon>
            </v-btn>
            <v-btn
              v-shared-tooltip="_ => t('env.select.fit')"
              text
              icon
              @click="selectFit"
            >
              <v-icon>
                tab_unselected
              </v-icon>
            </v-btn>

            <v-btn
              v-shared-tooltip="_ => t('env.select.none')"
              text
              icon
              @click="selectNone"
            >
              <v-icon>
                deselect
              </v-icon>
            </v-btn>
            <v-text-field
              v-model="search"
              class="max-w-50 pl-1"
              dense
              outlined
              flat
              prepend-inner-icon="search"
              hide-details
            />
          </div>
          <div
            class="pt-2 px-2"
          >
            <v-data-table
              v-model="selected"
              item-key="path"
              show-select
              :search="search"
              :headers="headers"
              :items="enabled"
            >
              <template #item.name="{ item }">
                <!-- <v-chip
                  :color="getColor(item.calories)"
                  dark
                >
                  {{ item.calories }}
                </v-chip> -->
                <v-list-item-avatar :size="30">
                  <img
                    :src="item.icon || BuiltinImages.unknownServer"
                  >
                </v-list-item-avatar>

                {{ item.name }}
              </template>
              <template #item.side="{ item }">
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
          <v-checkbox
            v-model="isAcceptEula"
          >
            <template #label>
              <i18n-t
                keypath="eula.body"
                tag="span"
              >
                <template #eula>
                  <a
                    href="https://aka.ms/MinecraftEULA"
                    target="_blank"
                    @click.stop
                  >EULA</a>
                </template>
              </i18n-t>
            </template>
          </v-checkbox>
        </div>
      </div>
      <v-divider />
      <div class="flex p-4">
        <div class="flex-grow" />
        <v-btn
          color="primary"
          :disabled="!isAcceptEula"
          :loading="loading"
          @click="onPlay"
        >
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
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { kInstanceSave } from '@/composables/instanceSave'
import { useService } from '@/composables/service'
import { BuiltinImages } from '@/constant'
import { vFallbackImg } from '@/directives/fallbackImage'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { InstallServiceKey, InstanceModsServiceKey, InstanceOptionsServiceKey, InstanceSavesServiceKey, RuntimeVersions } from '@xmcl/runtime-api'

defineProps<{ }>()

const port = ref(25565)
const motd = ref('')
const maxPlayers = ref(20)
const onlineMode = ref(false)
const isAcceptEula = ref(false)
const nogui = ref(false)
const linkedWorld = ref('')
const { getEULA, setEULA, getServerProperties, setServerProperties } = useService(InstanceOptionsServiceKey)
const { linkSaveAsServerWorld, getLinkedSaveWorld } = useService(InstanceSavesServiceKey)

let _serverProperties: any
let _eula: boolean

const { launch, gameProcesses } = injection(kInstanceLaunch)
const { installServer } = injection(kInstanceVersionInstall)
const { versionId, serverVersionId, serverVersionHeader } = injection(kInstanceVersion)

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

let lastPath = ''
const { isShown } = useDialog('launch-server', () => {
  if (lastPath === path.value) return
  lastPath = path.value
  getServerProperties(path.value).then((p) => {
    const parsedPort = parseInt(p.port, 10)
    port.value = isNaN(parsedPort) ? 25565 : parsedPort
    motd.value = p.motd || 'A Minecraft Server'
    const parsedMaxPlayers = parseInt(p.maxPlayers, 10)
    maxPlayers.value = isNaN(parsedMaxPlayers) ? 20 : parsedMaxPlayers
    onlineMode.value = Boolean(p.onlineMode)
    _serverProperties = p
  })
  getEULA(path.value).then((v) => {
    isAcceptEula.value = v
    _eula = v
  })
  getLinkedSaveWorld(path.value).then((v) => {
    linkedWorld.value = v ?? ''
  })
  getServerInstanceMods(path.value).then((mods) => {
    const all = enabled.value
    if (mods.length > 0) {
      selected.value = all.filter(m => mods.some(a => a.ino === m.resource.ino))
    } else {
      selected.value = all
    }
  })
})
const { t } = useI18n()

const { runtime, path } = injection(kInstance)
const { saves } = injection(kInstanceSave)
const { mods } = injection(kInstanceModsContext)
const enabled = computed(() => mods.value.filter(m => m.enabled))
const search = ref('')

function getSide(mod: ModFile) {
  const fabric = mod.resource.metadata.fabric
  if (fabric) {
    let env: 'client' | 'server' | '*' | undefined
    if (fabric instanceof Array) {
      env = fabric[0].environment
    } else {
      env = fabric.environment
    }
    if (env === '*' || !env) {
      return t('modrinth.environments.client') + '/' + t('modrinth.environments.server')
    }
    if (env === 'client') {
      return t('modrinth.environments.client')
    }
    if (env === 'server') {
      return t('modrinth.environments.server')
    }
  }
  return '?'
}

const headers = computed(() => [
  {
    text: t('mod.name'),
    value: 'name',
  },
  {
    text: t('modrinth.environments.name'),
    value: 'side',
  },
])

const selected = ref<ModFile[]>([])

const { installDependencies, installMinecraftJar } = useService(InstallServiceKey)
const { installToServerInstance, getServerInstanceMods } = useService(InstanceModsServiceKey)

function selectFit() {
  const filtered = enabled.value.filter(v => {
    const fabric = v.resource.metadata.fabric
    if (fabric) {
      let env: 'client' | 'server' | '*' | undefined
      if (fabric instanceof Array) {
        env = fabric[0].environment
      } else {
        env = fabric.environment
      }
      if (env === 'client') {
        return false
      }
    }
    return true
  })
  selected.value = filtered
}

function selectAll() {
  selected.value = enabled.value
}

function selectNone() {
  selected.value = []
}

const { refresh: onPlay, refreshing: loading, error } = useRefreshable(async () => {
  const runtimeValue = runtime.value
  const instPath = path.value
  let version = serverVersionId.value
  const _maxPlayers = maxPlayers.value
  const _port = port.value
  const _motd = motd.value
  const _onlineMode = onlineMode.value
  const _nogui = nogui.value
  const _mods = selected.value

  if (!_eula) {
    await setEULA(instPath, true)
  }
  if (_serverProperties) {
    await setServerProperties(instPath, {
      ..._serverProperties,
      port: _port ?? 25565,
      motd: _motd || 'A Minecraft Server',
      'max-players': _maxPlayers ?? 20,
      'online-mode': _onlineMode ?? false,
    })
  }
  if (!version) {
    const versionIdToInstall = await installServer(runtimeValue, instPath, version)
    await installMinecraftJar(runtimeValue.minecraft, 'server')
    await installDependencies(versionIdToInstall, 'server')
    version = versionIdToInstall
  } else {
    await installMinecraftJar(runtimeValue.minecraft, 'server')
    await installDependencies(version, 'server')
  }
  if (linkedWorld.value) {
    await linkSaveAsServerWorld({
      instancePath: instPath,
      saveName: linkedWorld.value,
    })
  }
  await installToServerInstance({
    path: instPath,
    mods: _mods.map(v => v.resource),
  })
  await launch('server', { nogui: _nogui, version })
})

</script>
