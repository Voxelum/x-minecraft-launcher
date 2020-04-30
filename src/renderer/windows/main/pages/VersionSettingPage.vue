<template>
  <v-container grid-list-xs fill-height>
    <v-layout row wrap>
      <v-flex tag="h1" style="margin-bottom: 10px;" class="white--text" xs6>
        <span class="headline">{{ $t('profile.versionSetting') }}</span>
      </v-flex>
      <v-flex xs12>
        <v-tabs v-model="active" mandatory color="transparent" dark :slider-color="barColor">
          <v-tab>
            <div class="version-tab">
              {{ $t('version.locals') }}
            </div>
          </v-tab>
          <v-tab>
            <div class="version-tab">
              Minecraft
              <div class="subtitle">
                {{ minecraftVersion }}
              </div>
            </div>
          </v-tab>
          <v-tab>
            <div class="version-tab">
              Forge
              <div class="subtitle">
                {{ forgeVersion || $t('version.unset') }}
              </div>
            </div>
          </v-tab>
          <v-tab>
            <div class="version-tab">
              Fabric
              <div class="subtitle">
                {{ fabricLoaderVersion || $t('version.unset') }}
              </div>
            </div>
          </v-tab>
          <v-tab>
            Liteloader
          </v-tab>
        </v-tabs>
        <v-tabs-items 
          v-model="active" 
          color="transparent" dark slider-color="primary" style="height: 70vh; overflow-y: hidden"
          @mousewheel.stop>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <local-version-list
              :value="localVersion"
              :filter-text="filterText"
              @input="setLocalVersion" />
          </v-tab-item>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <div style="display: flex !important; height: 100%; flex-direction: column;">
              <v-list-tile style="margin: 0px 0;">
                <v-checkbox 
                  v-model="showAlpha" 
                  :label="$t('minecraft.showAlpha')" />
              </v-list-tile>
              <v-divider dark />
              <refreshing-tile 
                v-if="isMinecraftRefreshing" />
              <minecraft-version-list
                v-else-if="minecraftVersions.length !== 0"
                :value="minecraftVersion"
                :statuses="minecraftStatus"
                :versions="minecraftVersions"
                :select="selectMinecraftVersion"
              />
              <hint 
                v-else 
                v-ripple 
                style="flex-grow: 1" 
                icon="refresh"
                :text="$t('minecraft.noVersion', { version: minecraftVersion })" 
                @click="refreshMinecraft" 
              />
            </div>
          </v-tab-item>
          <v-tab-item style="height: 100%;" @mousewheel.stop>
            <div style="display: flex !important; height: 100%; flex-direction: column;">
              <v-list-tile>
                <v-checkbox 
                  v-model="recommendedAndLatestOnly" 
                  :label="$t('forge.recommendedAndLatestOnly')" />
                <v-spacer />
                <v-checkbox 
                  v-model="showBuggy" 
                  :label="$t('forge.showBuggy')" />
              </v-list-tile>
              <v-divider dark />
              <refreshing-tile 
                v-if="isForgeRefreshing" />
              <forge-version-list 
                v-else-if="forgeVersions.length !== 0"
                :value="forgeVersions"
                :select="selectForgeVersion"
                :status="forgeStatuses"
                :selected="forgeVersion"
              />
              <hint 
                v-else 
                v-ripple 
                style="flex-grow: 1" 
                icon="refresh" 
                :text="$t('forge.noVersion', { version: minecraftVersion })" 
                @click="refreshForge"
              />
            </div>
          </v-tab-item>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <div style="display: flex !important; height: 100%; flex-direction: column;">
              <v-list-tile>
                <v-checkbox 
                  v-model="showStableOnly" 
                  :label="$t('fabric.showStableOnly')" />
              </v-list-tile>
              <v-divider dark />
              <v-layout v-if="fabricSupported">
                <v-flex xs6>
                  <fabric-artifact-version-list
                    :versions="fabricYarnVersions"
                    :version="fabricYarnVersion"
                    :statuses="{}"
                    :select="selectFabricYarnVersion"
                  /> 
                </v-flex>
                <v-divider dark vertical />
                <v-flex xs6>
                  <fabric-artifact-version-list
                    :versions="fabricLoaderVersions"
                    :version="fabricLoaderVersion"
                    :statuses="{}"
                    :select="selectFabricLoaderVersion"
                  /> 
                </v-flex>
              </v-layout>
              <hint
                v-else
                style="flex-grow: 1" 
                icon="refresh" 
                :text="$t('fabric.noVersion', { version: minecraftVersion })" 
              />
            </div>
          </v-tab-item>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <!-- <liteloader-version-list 
              :mcversion="minecraftVersion" 
              :filter-text="filterText"
              @value="liteloaderVersion = $event ? $event.version : ''" /> -->
          </v-tab-item>
        </v-tabs-items>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import Vue from 'vue';
import { defineComponent, reactive, computed, ref, onMounted, toRefs, watch, Ref } from '@vue/composition-api';
import {
  useAutoSaveLoad,
  useInstance,
  useForgeVersions,
  useMinecraftVersions,
  useIsCompatible,
  useFabricVersions,
} from '@/hooks';
import { Version as ForgeVersion } from '@xmcl/installer/forge';
import { Version as MinecraftVersion } from '@xmcl/installer/minecraft';
import { FabricArtifactVersion } from '@xmcl/installer/fabric';

function compositeForgeVersions(mcversion: Ref<string>, filterText: Ref<string>) {
  const data = reactive({
    recommendedOnly: true,
    showBuggy: false,
    forgeVersion: '',
  });
  const { statuses, versions, refreshing, refresh } = useForgeVersions(mcversion);
  function selectVersion(item: ForgeVersion) {
    data.forgeVersion = item.version;
  }
  function filterForge(version: ForgeVersion) {
    if (data.recommendedOnly && version.type !== 'recommended' && version.type !== 'latest') return false;
    if (data.showBuggy && version.type !== 'buggy') return true;
    return version.version.indexOf(filterText.value) !== -1;
  }
  function clearForge() {
    data.forgeVersion = '';
  }

  const filteredVersions = computed(() => versions.value.filter(filterForge));

  watch(filteredVersions, () => {
    if (filteredVersions.value.length === 0) {
      data.recommendedOnly = false;
    }
  });

  return {
    ...toRefs(data),
    forgeStatuses: statuses,
    forgeVersions: filteredVersions,
    isForgeRefreshing: refreshing,
    clearForge,
    refreshForge: refresh,
    selectForgeVersion: selectVersion,
  };
}

function compositeMinecraftVersion(filterText: Ref<string>) {
  const data = reactive({
    acceptingRange: '',

    showAlpha: false,
    showBuggy: false,
    recommendedAndLatestOnly: true,
  });

  const minecraftVersion = ref('');

  const { versions, statuses, isMinecraftRefreshing } = useMinecraftVersions();
  const { isCompatible } = useIsCompatible();
  function selectVersion(v: MinecraftVersion) {
    minecraftVersion.value = v.id;
  }

  function filterMinecraft(v: MinecraftVersion) {
    if (!data.showAlpha && v.type !== 'release') return false;
    // if (!isCompatible(data.acceptingRange, v.id)) return false;
    return v.id.indexOf(filterText.value) !== -1;
  }
  const minecraftVersions = computed(() => versions.value.filter(filterMinecraft));
  return {
    ...toRefs(data),
    minecraftVersion,
    minecraftVersions,
    isMinecraftRefreshing,
    minecraftStatus: statuses,
    selectMinecraftVersion: selectVersion,
  };
}

function compositeFabricVersion(mcversion: Ref<string>, filterText: Ref<string>) {
  const data = reactive({
    fabricYarnVersion: '',
    fabricLoaderVersion: '',
    showStableOnly: true,
  });

  const { yarnVersions, loaderVersions } = useFabricVersions();
  const selectFabricYarnVersion = (v: FabricArtifactVersion) => {
    data.fabricYarnVersion = v.version;
  };
  const selectFabricLoaderVersion = (v: FabricArtifactVersion) => {
    data.fabricLoaderVersion = v.version;
  };
  const clearFabric = () => {
    data.fabricYarnVersion = '';
    data.fabricLoaderVersion = '';
  };

  watch([mcversion, loaderVersions, yarnVersions], () => {
    if (loaderVersions.value.every(v => !v.stable)) {
      data.showStableOnly = false;
    }
  });

  const fabricLoaderVersions = computed(() => loaderVersions.value.filter((v) => {
    if (data.showStableOnly && !v.stable) {
      return false;
    }
    return true;
    // return v.version.indexOf(filterText.value) !== -1;
  }));
  const fabricYarnVersions = computed(() => yarnVersions.value.filter((v) => {
    if (v.gameVersion !== mcversion.value) {
      return false;
    }
    if (data.showStableOnly && !v.stable) {
      return false;
    }
    return true;
    // return v.version.indexOf(filterText.value) !== -1;
  }));
  const fabricVersion = computed(() => data.fabricYarnVersion + data.fabricLoaderVersion);
  const fabricSupported = computed(() => !!yarnVersions.value.find(v => v.gameVersion === mcversion.value));

  return {
    ...toRefs(data),
    fabricVersion,
    selectFabricLoaderVersion,
    selectFabricYarnVersion,
    fabricYarnVersions,
    fabricLoaderVersions,
    fabricSupported,
    clearFabric,
  };
}

export default defineComponent({
  setup() {
    const filterText = ref('');
    const data = reactive({
      active: 0,
      searchPanel: false,

      liteloaderVersion: '',
    });
    const mc = compositeMinecraftVersion(filterText);
    const { minecraftVersion } = mc;
    const forge = compositeForgeVersions(minecraftVersion, filterText);
    const { forgeVersion } = forge;
    const fabric = compositeFabricVersion(minecraftVersion, filterText);
    const { fabricYarnVersion, fabricLoaderVersion } = fabric;

    const { editInstance: edit, runtime } = useInstance();
    const localVersion = computed(() => ({
      minecraft: minecraftVersion.value,
      forge: forgeVersion.value,
      liteloader: data.liteloaderVersion,
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

    onMounted(() => {
      watch(minecraftVersion, () => {
        console.log(minecraftVersion.value);
        // forgeVersion.value = '';
        // fabricLoaderVersion.value = '';
        // fabricYarnVersion.value = '';
        // data.liteloaderVersion = '';
      });
    });
    function save() {
      edit({
        runtime: {
          minecraft: minecraftVersion.value,
          forge: forgeVersion.value,
          // liteloader: data.liteloaderVersion,
          fabricLoader: fabricLoaderVersion.value,
          yarn: fabricYarnVersion.value,
        },
      });
    }
    async function load() {
      const { forge, minecraft, liteloader, fabricLoader, yarn } = runtime.value;
      minecraftVersion.value = minecraft;
      Vue.nextTick(() => {
        forgeVersion.value = forge;
        fabricYarnVersion.value = yarn;
        fabricLoaderVersion.value = fabricLoader;
        // data.liteloaderVersion = liteloader;
      });
    }
    useAutoSaveLoad(save, load);

    return {
      ...toRefs(data),
      ...mc,
      ...forge,
      ...fabric,

      localVersion,
      filterText,
      setLocalVersion(v: { minecraft: string; forge: string; liteloader: string }) {
        minecraftVersion.value = v.minecraft;
        Vue.nextTick().then(() => {
          forgeVersion.value = v.forge;
          data.liteloaderVersion = v.liteloader;
        });
      },
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
