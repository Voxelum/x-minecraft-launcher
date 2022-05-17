<template>
  <v-container
    class="versions-setting h-full pb-0 overflow-y-hidden"
    grid-list-md
  >
    <div class="flex flex-col h-full overflow-auto gap-3 mt-2">
      <v-card-title>
        {{ $t("versionSetting.title") }}
      </v-card-title>
      <!-- <div
        tag="h1"
        class="mb-3 select-none mx-4"
        xs6
      >
        <span class="headline"></span>
      </div> -->
      <v-tabs
        v-model="active"
        background-color="transparent"
        class="flex-grow flex flex-col bg-transparent"
        mandatory
        :color="barColor"
        :slider-color="barColor"
      >
        <v-tab>
          <div class="version-tab">
            {{ $t("localVersion.title") }}
            <div class="subtitle">
              {{ localVersion ? localVersion.id : '' }}
            </div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Minecraft
            <div class="subtitle">
              {{ data.minecraft }}
            </div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Forge
            <div class="subtitle">
              {{ data.forge || $t("versionSetting.unset") }}
            </div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Fabric
            <div class="subtitle">
              {{ data.fabricLoader || $t("versionSetting.unset") }}
            </div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Optifine
            <div class="subtitle">
              {{ data.optifine || $t("versionSetting.unset") }}
            </div>
          </div>
        </v-tab>
      </v-tabs>
      <v-tabs-items
        v-model="active"
        background-color="transparent"
        class="h-full overflow-auto"
        @mousewheel.stop
      >
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <local-version-view
            :value="localVersion"
            :filter-text="filterText"
            @input="setLocalVersion"
          />
        </v-tab-item>
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <minecraft-view
            :filter-text="filterText"
            :version="data.minecraft"
            :select="setMinecraft"
          />
        </v-tab-item>
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <forge-view
            :filter-text="filterText"
            :version="data.forge"
            :select="setForge"
            :minecraft="data.minecraft"
          />
        </v-tab-item>
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <fabric-view
            :filter-text="filterText"
            :loader="data.fabricLoader"
            :select="setFabric"
            :minecraft="data.minecraft"
          />
        </v-tab-item>
        <v-tab-item
          class="h-full overflow-auto"
          @mousewheel.stop
        >
          <optifine-view
            :filter-text="filterText"
            :version="optifineVersion"
            :select="setOptifine"
            :minecraft="data.minecraft"
          />
        </v-tab-item>
      </v-tabs-items>
    </div>
    <v-fab-transition>
      <v-btn
        v-if="active !== 0"
        large
        absolute

        fab
        class="right-10 bottom-10"
        color="primary"
        :loading="refreshing"
        @dragover.prevent
        @click="refresh"
      >
        <v-icon>refresh</v-icon>
      </v-btn>
    </v-fab-transition>
  </v-container>
</template>

<script lang=ts setup>
import type { ResolvedVersion } from '@xmcl/core'
import type { MinecraftVersion } from '@xmcl/installer'
import { filterForgeVersion, filterOptifineVersion, getResolvedVersion, isFabricLoaderLibrary, isForgeLibrary, isOptifineLibrary, OptifineVersion, InstallServiceKey, VersionServiceKey } from '@xmcl/runtime-api'
import { useAutoSaveLoad, useServiceBusy, useService, useRouter } from '/@/composables'
import FabricView from './VersionFabricView.vue'
import ForgeView from './VersionForgeView.vue'
import MinecraftView from './VersionMinecraftView.vue'
import OptifineView from './VersionOptifineView.vue'
import LocalVersionView from './VersionLocalView.vue'
import { useInstance } from '../composables/instance'

const props = defineProps<{ target?: string }>()
const { replace } = useRouter()

const targetToId: Record<string, number> = {
  minecraft: 1,
  forge: 2,
  fabric: 3,
  optifine: 4,
}
const idToTarget = ['minecraft', 'forge', 'fabric', 'optifine']

const active = computed({
  get() { return props.target ? (targetToId[props.target] ?? 0) : 0 },
  set(v: number) {
    replace({ query: { target: idToTarget[v - 1] ?? undefined } })
  },
})

const filterText = ref('')
const { refreshForge, refreshFabric, refreshLiteloader, refreshOptifine, refreshMinecraft } = useService(InstallServiceKey)
const data = reactive({
  minecraft: '',
  forge: '',
  fabricLoader: '',
  yarn: '',
  optifine: '',

  id: '',

  // unused
  liteloader: '',
})
const refreshingForge = useServiceBusy(InstallServiceKey, 'refreshForge')
const refreshingMinecraft = useServiceBusy(InstallServiceKey, 'refreshMinecraft')
const refreshingFabric = useServiceBusy(InstallServiceKey, 'refreshFabric')
const refreshingOptifine = useServiceBusy(InstallServiceKey, 'refreshOptifine')

const refreshing = computed(() => {
  if (active.value === 1) return refreshingMinecraft.value
  if (active.value === 2) return refreshingForge.value
  if (active.value === 3) return refreshingFabric.value
  if (active.value === 4) return refreshingOptifine.value
  return false
})

const optifineVersion = computed(() => {
  const index = data.optifine.lastIndexOf('_')
  const type = data.optifine.substring(0, index)
  const patch = data.optifine.substring(index + 1, data.optifine.length)
  return { type, patch }
})

const { editInstance: edit, runtime, version } = useInstance()
const { state } = useService(VersionServiceKey)
const barColor = computed(() => {
  switch (active.value) {
    case 0: return 'currentColor'
    case 1: return 'primary'
    case 2: return 'brown'
    case 3: return 'orange'
    case 4: return 'cyan'
    default: return 'primary'
  }
})

const localVersion = computed(() => {
  return getResolvedVersion(state.local, data as any, data.id)
})
function setLocalVersion(v: ResolvedVersion) {
  data.minecraft = v.minecraftVersion
  data.forge = filterForgeVersion(v.libraries.find(isForgeLibrary)?.version ?? '')
  data.liteloader = ''
  data.fabricLoader = v.libraries.find(isFabricLoaderLibrary)?.version ?? ''
  data.optifine = filterOptifineVersion(v.libraries.find(isOptifineLibrary)?.version ?? '')
  data.yarn = ''
  data.id = v.id ?? ''
}
function setMinecraft(v: MinecraftVersion) {
  if (data.minecraft !== v.id && v.id.length > 0) {
    data.minecraft = v.id
    data.forge = ''
    data.liteloader = ''
    data.fabricLoader = ''
    data.yarn = ''
    data.optifine = ''
    data.id = ''
  }
}
function setOptifine(v: OptifineVersion | undefined) {
  if (!v) {
    data.optifine = ''
    data.id = ''
  } else {
    data.optifine = `${v.type}_${v.patch}`
    data.id = ''
  }
}
function setForge(v: { version: string } | undefined) {
  if (!v) {
    data.forge = ''
  } else if (v.version.length > 0) {
    data.forge = v.version
    data.id = ''
    data.fabricLoader = ''
  }
}
function setFabric(v?: { version: string }) {
  if (v) {
    data.fabricLoader = v.version
    data.id = ''
    data.forge = ''
  } else {
    data.fabricLoader = ''
    data.id = ''
    data.yarn = ''
  }
}
function refresh() {
  if (active.value === 1) {
    refreshMinecraft(true)
  } else if (active.value === 2) {
    refreshForge({ force: true, mcversion: data.minecraft })
  } else if (active.value === 3) {
    refreshFabric(true)
  } else if (active.value === 4) {
    refreshOptifine(true)
  }
}
function save() {
  if (data.minecraft.length > 0) {
    edit({
      version: data.id,
      runtime: {
        minecraft: data.minecraft,
        forge: data.forge,
        fabricLoader: data.fabricLoader,
        yarn: data.yarn,
        liteloader: data.liteloader,
        optifine: data.optifine,
      },
    })
  }
}
async function load() {
  const { forge, minecraft, liteloader, fabricLoader, yarn, optifine } = runtime.value
  data.id = version.value
  data.minecraft = minecraft
  data.forge = forge ?? ''
  data.yarn = yarn ?? ''
  data.fabricLoader = fabricLoader ?? ''
  data.optifine = optifine ?? ''
  data.liteloader = liteloader ?? ''
}

useAutoSaveLoad(save, load)

</script>

<style scoped=true>
.subtitle {
  color: grey;
  font-size: 14px;
  @apply break-words whitespace-nowrap overflow-auto;
}
.version-tab {
  max-width: 100px;
  min-width: 100px;
}
</style>

<style>
.versions-setting .v-window__container {
  height: 100%;
}

.versions-setting .v-tabs-items {
  background: transparent !important;
  background-color: transparent !important;
}

</style>
