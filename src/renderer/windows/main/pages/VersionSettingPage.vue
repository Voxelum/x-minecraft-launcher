<template>
  <v-container grid-list-xs fill-height>
    <v-layout row wrap>
      <v-flex tag="h1" style="margin-bottom: 10px;" class="white--text" xs6>
        <span class="headline">{{ $t('profile.versionSetting') }}</span>
      </v-flex>
      <v-flex xs12>
        <v-tabs v-model="active" mandatory color="transparent" dark :slider-color="barColor">
          <v-tab>
            <div class="version-tab">{{ $t('version.locals') }}</div>
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
              <div class="subtitle">{{ forge || $t('version.unset') }}</div>
            </div>
          </v-tab>
          <v-tab>
            <div class="version-tab">
              Fabric
              <div class="subtitle">{{ loader || $t('version.unset') }}</div>
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
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <local-version-list
              :value="localVersion"
              :filter-text="filterText"
              @input="setLocalVersion"
            />
          </v-tab-item>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <minecraft-view :filter-text="filterText" :version="minecraft" :select="setMinecraft" />
          </v-tab-item>
          <v-tab-item style="height: 100%;" @mousewheel.stop>
            <forge-view
              :filter-text="filterText"
              :version="forge"
              :select="setForge"
              :minecraft="minecraft"
            />
          </v-tab-item>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <fabric-view
              :filter-text="filterText"
              :loader="loader"
              :yarn="yarn"
              :select="setFabric"
              :minecraft="minecraft"
            />
          </v-tab-item>
        </v-tabs-items>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, reactive, computed, ref, toRefs } from '@vue/composition-api';
import {
  useAutoSaveLoad,
  useInstance,
} from '@/hooks';
import type { ForgeVersion, MinecraftVersion } from '@xmcl/installer';
import { LocalVersion } from '@universal/entities/version';
import MinecraftView from './VersionSettingPageMinecraftView.vue';
import ForgeView from './VersionSettingPageForgeView.vue';
import FabricView from './VersionSettingPageFabricView.vue';

export default defineComponent({
  components: {
    MinecraftView, ForgeView, FabricView,
  },
  setup() {
    const filterText = ref('');
    const data = reactive({
      active: 0,

      minecraft: '',
      forge: '',
      loader: '',
      yarn: '',

      // unused
      liteloader: '',
    });

    const { editInstance: edit, runtime } = useInstance();
    const localVersion = computed(() => ({
      minecraft: data.minecraft,
      forge: data.forge,
      liteloader: data.liteloader,
      fabricLoader: data.loader,
      yarn: data.yarn,
    }));
    const barColor = computed(() => {
      switch (data.active) {
        case 0: return 'white';
        case 1: return 'primary';
        case 2: return 'brown';
        case 3: return 'orange';
        case 4: return 'cyan';
        default: return 'primary';
      }
    });

    function setLocalVersion(v: LocalVersion) {
      data.minecraft = v.minecraft;
      data.forge = v.forge;
      data.liteloader = v.liteloader;
      data.loader = v.fabricLoader;
      data.yarn = v.yarn;
    }
    function setMinecraft(v: MinecraftVersion) {
      if (data.minecraft !== v.id) {
        data.minecraft = v.id;
        data.forge = '';
        data.liteloader = '';
        data.loader = '';
        data.yarn = '';
      }
    }
    function setForge(v: ForgeVersion | undefined) {
      if (!v) {
        data.forge = '';
      } else {
        data.forge = v.version;
        data.loader = '';
      }
    }
    function setFabric(version?: string) {
      if (version) {
        data.loader = version;
        data.forge = '';
      } else {
        data.loader = '';
        data.yarn = '';
      }
    }
    function save() {
      edit({
        runtime: {
          minecraft: data.minecraft,
          forge: data.forge,
          fabricLoader: data.loader,
          yarn: data.yarn,
          liteloader: data.liteloader,
        },
      });
    }
    async function load() {
      const { forge, minecraft, liteloader, fabricLoader, yarn } = runtime.value;
      data.minecraft = minecraft;
      data.forge = forge;
      data.yarn = yarn;
      data.loader = fabricLoader;
    }

    useAutoSaveLoad(save, load);

    return {
      ...toRefs(data),

      setMinecraft,
      setForge,
      setFabric,
      setLocalVersion,

      localVersion,
      filterText,

      barColor,
    };
  },
});
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
