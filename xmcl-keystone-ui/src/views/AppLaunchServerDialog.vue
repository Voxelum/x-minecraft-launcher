<template>
  <v-dialog
    :value="isShown"
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
        class="visible-scroll flex flex-col max-h-[600px] mx-0 overflow-y-auto overflow-x-hidden px-6 py-2"
      >
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
            v-model="onlineMode"
            class="col-start-3"
            :label="t('server.onlineMode')"
          />
        </div>
        <v-subheader>{{ t('save.name') }}</v-subheader>
        {{ linkedWorld }}
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
                  v-fallback-img="unknownPack"
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
          <v-subheader>{{ t('mod.name') }}</v-subheader>
          <div
            class="pt-2 px-2"
          >
            <v-list
              dense
              class="max-h-80 overflow-auto"
            >
              <v-list-item
                v-for="m of enabled"
                :key="m.path"
              >
                <v-list-item-avatar :size="30">
                  <img
                    ref="iconImage"
                    :src="m.icon || unknownPack"
                  >
                </v-list-item-avatar>
                <v-list-item-title class="flex overflow-hidden">
                  {{ m.name }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
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
        <v-btn text>
          <v-icon>
            close
          </v-icon>
          {{ t('cancel') }}
        </v-btn>
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
import unknownPack from '@/assets/unknown_pack.png'
import { useRefreshable } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceModsContext } from '@/composables/instanceMods'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { kInstanceSave } from '@/composables/save'
import { useService } from '@/composables/service'
import { vFallbackImg } from '@/directives/fallbackImage'
import { injection } from '@/util/inject'
import { InstallServiceKey, InstanceOptionsServiceKey, InstanceSavesServiceKey } from '@xmcl/runtime-api'

defineProps<{ }>()

const port = ref(25565)
const motd = ref('')
const maxPlayers = ref(20)
const onlineMode = ref(false)
const isAcceptEula = ref(false)
const linkedWorld = ref('')
const { getEULA, setEULA, getServerProperties, setServerProperties } = useService(InstanceOptionsServiceKey)
const { linkSaveAsServerWorld, getLinkedSaveWorld } = useService(InstanceSavesServiceKey)

let _serverProperties: any
let _eula: boolean

const { launch } = injection(kInstanceLaunch)
const { installServer } = injection(kInstanceVersionInstall)
const { versionId, serverVersionId } = injection(kInstanceVersion)

const selectedSave = computed({
  get() {
    if (linkedWorld.value === '') return 0
    const i = saves.value.findIndex(s => s.path === linkedWorld.value)
    console.log(i)
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

const { isShown } = useDialog('launch-server', () => {
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
})
const { t } = useI18n()

const { runtime, path } = injection(kInstance)
const { saves } = injection(kInstanceSave)
const { mods } = injection(kInstanceModsContext)
const enabled = computed(() => mods.value.filter(m => m.enabled))

const { installDependencies, installMinecraftServerJar } = useService(InstallServiceKey)

const { refresh: onPlay, refreshing: loading } = useRefreshable(async () => {
  if (!_eula) {
    await setEULA(path.value, true)
  }
  if (_serverProperties) {
    await setServerProperties(path.value, {
      ..._serverProperties,
      port: port.value ?? 25565,
      motd: motd.value || 'A Minecraft Server',
      maxPlayers: maxPlayers.value ?? 20,
      onlineMode: onlineMode.value ?? false,
    })
  }
  const runtimeValue = runtime.value
  if (!serverVersionId.value) {
    const versionIdToInstall = await installServer(runtimeValue, path.value, versionId.value)
    await installMinecraftServerJar(runtimeValue.minecraft)
    await installDependencies(versionIdToInstall, 'server')
  } else {
    await installMinecraftServerJar(runtimeValue.minecraft)
    await installDependencies(serverVersionId.value, 'server')
  }
  if (linkedWorld.value) {
    await linkSaveAsServerWorld({
      instancePath: path.value,
      saveName: linkedWorld.value,
    })
  }
  await launch('server')
})

</script>
