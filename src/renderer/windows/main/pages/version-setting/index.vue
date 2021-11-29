<template>
  <v-container grid-list-md fill-height>
    <div class="flex flex-col h-full overflow-auto gap-3 mt-2">
      <div tag="h1" class="mb-3 white--text select-none" xs6>
        <span class="headline">{{ $t("profile.versionSetting") }}</span>
      </div>
      <v-tabs
        class="flex-grow flex flex-col"
        v-model="active"
        mandatory
        color="transparent"
        dark
        :slider-color="barColor"
      >
        <v-tab>
          <div class="version-tab">
            {{ $t("version.locals") }}
            <div class="subtitle">{{ id }}</div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Minecraft
            <div class="subtitle">{{ minecraft }}</div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Forge
            <div class="subtitle">{{ forge || $t("version.unset") }}</div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Fabric
            <div class="subtitle">{{ fabricLoader || $t("version.unset") }}</div>
          </div>
        </v-tab>
        <v-tab>
          <div class="version-tab">
            Optifine
            <div class="subtitle">{{ optifine || $t("version.unset") }}</div>
          </div>
        </v-tab>
      </v-tabs>
      <v-tabs-items
        v-model="active"
        color="transparent"
        dark
        slider-color="primary"
        class="h-full overflow-auto"
        @mousewheel.stop
      >
        <v-tab-item class="h-full overflow-auto" @mousewheel.stop>
          <local-version-view
            :value="localVersion"
            :filter-text="filterText"
            @input="setLocalVersion"
          />
        </v-tab-item>
        <v-tab-item class="h-full overflow-auto" @mousewheel.stop>
          <minecraft-view :filter-text="filterText" :version="minecraft" :select="setMinecraft" />
        </v-tab-item>
        <v-tab-item class="h-full overflow-auto" @mousewheel.stop>
          <forge-view
            :filter-text="filterText"
            :version="forge"
            :select="setForge"
            :minecraft="minecraft"
          />
        </v-tab-item>
        <v-tab-item class="h-full overflow-auto" @mousewheel.stop>
          <fabric-view
            :filter-text="filterText"
            :loader="fabricLoader"
            :yarn="yarn"
            :select="setFabric"
            :minecraft="minecraft"
          />
        </v-tab-item>
        <v-tab-item class="h-full overflow-auto" @mousewheel.stop>
          <optifine-view
            :filter-text="filterText"
            :version="optifineVersion"
            :select="setOptifine"
            :minecraft="minecraft"
          />
        </v-tab-item>
      </v-tabs-items>
    </div>
    <v-fab-transition>
      <v-btn
        v-if="active !== 0"
        large
        absolute
        dark
        fab
        class="right-10 bottom-10"
        color="primary"
        @dragover.prevent
        :loading="refreshing"
        @click="refresh"
      >
        <v-icon>refresh</v-icon>
      </v-btn>
    </v-fab-transition>
  </v-container>
</template>

<script lang=ts>
import { computed, defineComponent, reactive, ref, toRefs, watch } from '@vue/composition-api'
import type { ResolvedVersion } from '@xmcl/core'
import type { FabricArtifactVersion, ForgeVersion, MinecraftVersion } from '@xmcl/installer'
import FabricView from './components/FabricVersionView.vue'
import ForgeView from './components/ForgeVersionView.vue'
import MinecraftView from './components/MinecraftVersionView.vue'
import OptifineView from './components/OptifineView.vue'
import {
  useAutoSaveLoad,
  useBusy,
  useInstance,
  useService,
  useVersionService,
} from '/@/hooks'
import { filterForgeVersion, filterOptfineVersion, getResolvedVersion, isFabricLoaderLibrary, isForgeLibrary, isOptifineLibrary } from '/@shared/entities/version'
import { OptifineVersion } from '/@shared/entities/version.schema'
import { InstallServiceKey } from '/@shared/services/InstallService'
import LocalVersionView from './components/LocalVersionView.vue'

export default defineComponent({
  components: {
    MinecraftView,
    ForgeView,
    FabricView,
    OptifineView,
    LocalVersionView
  },
  setup() {
    const filterText = ref('')
    const { refreshForge, refreshFabric, refreshLiteloader, refreshOptifine, refreshMinecraft } = useService(InstallServiceKey)
    const data = reactive({
      active: 0,

      minecraft: '',
      forge: '',
      fabricLoader: '',
      yarn: '',
      optifine: '',

      id: '',

      // unused
      liteloader: '',
    })
    const refreshingForge = useBusy('refreshForge()')
    const refreshingMinecraft = useBusy('refreshMinecraft()')
    const refreshingFabric = useBusy('refreshFabric()')
    const refreshingOptifine = useBusy('refreshOptifine()')

    const refreshing = computed(() => {
      if (data.active === 1) return refreshingMinecraft.value
      if (data.active === 2) return refreshingForge.value
      if (data.active === 3) return refreshingFabric.value
      if (data.active === 4) return refreshingOptifine.value
      return false
    })

    const optifine = computed(() => {
      const index = data.optifine.lastIndexOf('_')
      const type = data.optifine.substring(0, index)
      const patch = data.optifine.substring(index + 1, data.optifine.length)
      return { type, patch }
    })

    const { editInstance: edit, runtime, version } = useInstance()
    const { state } = useVersionService()
    const barColor = computed(() => {
      switch (data.active) {
        case 0: return 'white'
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
      data.optifine = filterOptfineVersion(v.libraries.find(isOptifineLibrary)?.version ?? '')
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
      console.log(v)
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
      if (data.active === 0) {

      } else if (data.active === 1) {
        refreshMinecraft(true)
      } else if (data.active === 2) {
        refreshForge({ force: true, mcversion: data.minecraft })
      } else if (data.active === 3) {
        refreshFabric(true)
      } else if (data.active === 4) {
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

    return {
      ...toRefs(data),
      refreshing,

      setMinecraft,
      setForge,
      setFabric,
      setOptifine,
      setLocalVersion,

      localVersion,
      filterText,
      optifineVersion: optifine,

      barColor,
      refresh,
    }
  },
})
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
.v-window__container {
  height: 100%;
}
</style>
