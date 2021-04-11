<template>
  <v-container
    grid-list-xs
    fill-height
  >
    <v-layout
      row
      wrap
    >
      <v-flex
        tag="h1"
        style="margin-bottom: 10px"
        class="white--text"
        xs6
      >
        <span class="headline">{{ $t("profile.versionSetting") }}</span>
      </v-flex>
      <v-flex xs12>
        <v-tabs
          v-model="active"
          mandatory
          color="transparent"
          dark
          :slider-color="barColor"
        >
          <v-tab>
            <div class="version-tab">
              {{ $t("version.locals") }}
            </div>
          </v-tab>
          <v-tab>
            <div class="version-tab">
              Minecraft
              <div class="subtitle">
                {{ minecraft }}
              </div>
            </div>
          </v-tab>
          <v-tab>
            <div class="version-tab">
              Forge
              <div class="subtitle">
                {{ forge || $t("version.unset") }}
              </div>
            </div>
          </v-tab>
          <v-tab>
            <div class="version-tab">
              Fabric
              <div class="subtitle">
                {{ loader || $t("version.unset") }}
              </div>
            </div>
          </v-tab>
          <v-tab>
            <div class="version-tab">
              Optifine
              <div class="subtitle">
                {{ optifine || $t("version.unset") }}
              </div>
            </div>
          </v-tab>
        </v-tabs>
        <v-tabs-items
          v-model="active"
          color="transparent"
          dark
          slider-color="primary"
          style="height: 70vh; overflow-y: hidden"
          @mousewheel.stop
        >
          <v-tab-item
            style="height: 100%"
            @mousewheel.stop
          >
            <local-version-list
              :value="localVersion"
              :filter-text="filterText"
              @input="setLocalVersion"
            />
          </v-tab-item>
          <v-tab-item
            style="height: 100%"
            @mousewheel.stop
          >
            <minecraft-view
              :filter-text="filterText"
              :version="minecraft"
              :select="setMinecraft"
            />
          </v-tab-item>
          <v-tab-item
            style="height: 100%"
            @mousewheel.stop
          >
            <forge-view
              :filter-text="filterText"
              :version="forge"
              :select="setForge"
              :minecraft="minecraft"
            />
          </v-tab-item>
          <v-tab-item
            style="height: 100%"
            @mousewheel.stop
          >
            <fabric-view
              :filter-text="filterText"
              :loader="loader"
              :yarn="yarn"
              :select="setFabric"
              :minecraft="minecraft"
            />
          </v-tab-item>
          <v-tab-item
            style="height: 100%"
            @mousewheel.stop
          >
            <optifine-view
              :filter-text="filterText"
              :version="optifineVersion"
              :select="setOptifine"
              :minecraft="minecraft"
            />
          </v-tab-item>
        </v-tabs-items>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { computed, defineComponent, reactive, ref, toRefs } from '@vue/composition-api'
import type { ResolvedVersion } from '@xmcl/core'
import type { ForgeVersion, MinecraftVersion } from '@xmcl/installer'
import FabricView from './VersionSettingPageFabricView.vue'
import ForgeView from './VersionSettingPageForgeView.vue'
import MinecraftView from './VersionSettingPageMinecraftView.vue'
import OptifineView from './VersionSettingPageOptifineView.vue'
import {
  useAutoSaveLoad,
  useInstance,
  useStore,
} from '/@/hooks'
import { filterForgeVersion, filterOptfineVersion, getResolvedVersion, isFabricLoaderLibrary, isForgeLibrary, isOptifineLibrary } from '/@shared/entities/version'
import { OptifineVersion } from '/@shared/entities/version.schema'

export default defineComponent({
  components: {
    MinecraftView, ForgeView, FabricView, OptifineView,
  },
  setup() {
    const filterText = ref('')
    const data = reactive({
      active: 0,

      minecraft: '',
      forge: '',
      loader: '',
      yarn: '',
      optifine: '',

      folder: '',

      // unused
      liteloader: '',
    })

    const optifine = computed(() => {
      const index = data.optifine.lastIndexOf('_')
      const type = data.optifine.substring(0, index)
      const patch = data.optifine.substring(index + 1, data.optifine.length)
      return { type, patch }
    })

    const { editInstance: edit, runtime, version } = useInstance()
    const { state } = useStore()
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
      return getResolvedVersion(state.version.local, data as any, '')
    })
    function setLocalVersion(v: ResolvedVersion) {
      data.minecraft = v.minecraftVersion
      data.forge = filterForgeVersion(v.libraries.find(isForgeLibrary)?.version ?? '')
      data.liteloader = ''
      data.loader = v.libraries.find(isFabricLoaderLibrary)?.version ?? ''
      data.optifine = filterOptfineVersion(v.libraries.find(isOptifineLibrary)?.version ?? '')
      data.yarn = ''
      data.folder = v.id ?? ''
    }
    function setMinecraft(v: MinecraftVersion) {
      if (data.minecraft !== v.id) {
        data.minecraft = v.id
        data.forge = ''
        data.liteloader = ''
        data.loader = ''
        data.yarn = ''
        data.optifine = ''
        data.folder = ''
      }
    }
    function setOptifine(v: OptifineVersion | undefined) {
      if (!v) {
        data.optifine = ''
      } else {
        data.optifine = `${v.type}_${v.patch}`
        data.folder = ''
      }
    }
    function setForge(v: ForgeVersion | undefined) {
      if (!v) {
        data.forge = ''
      } else {
        data.forge = v.version
        data.folder = ''
        data.loader = ''
      }
    }
    function setFabric(version?: string) {
      if (version) {
        data.loader = version
        data.forge = ''
      } else {
        data.loader = ''
        data.folder = ''
        data.yarn = ''
      }
    }
    function save() {
      edit({
        version: data.folder,
        runtime: {
          minecraft: data.minecraft,
          forge: data.forge,
          fabricLoader: data.loader,
          yarn: data.yarn,
          liteloader: data.liteloader,
          optifine: data.optifine,
        },
      })
    }
    async function load() {
      const { forge, minecraft, liteloader, fabricLoader, yarn, optifine } = runtime.value
      data.folder = version.value
      data.minecraft = minecraft
      data.forge = forge ?? ''
      data.yarn = yarn ?? ''
      data.loader = fabricLoader ?? ''
      data.optifine = optifine ?? ''
    }

    useAutoSaveLoad(save, load)

    return {
      ...toRefs(data),

      setMinecraft,
      setForge,
      setFabric,
      setOptifine,
      setLocalVersion,

      localVersion,
      filterText,
      optifineVersion: optifine,

      barColor,
    }
  },
})
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important;
}
.subtitle {
  color: grey;
  font-size: 14px;
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
