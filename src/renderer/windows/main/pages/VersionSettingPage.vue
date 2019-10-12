<template>
  <v-container grid-list-xs fill-height>
    <v-layout row wrap>
      <v-flex tag="h1" style="margin-bottom: 10px;" class="white--text" xs6>
        <span class="headline">{{ $t('profile.versionSetting') }}</span>
      </v-flex>
      <v-flex xs6 style="margin-top: 10px;">
        <v-layout row align-end justify-end>
          <v-spacer />
          <v-chip color="primary" label dark outline style="transition: transform 1s;">
            Minecraft:  {{ mcversion }}
          </v-chip>
          <v-expand-x-transition>
            <v-chip v-show="forgeVersion !== ''" color="brown" label dark outline style="white-space: nowrap">
              Forge:
              {{ forgeVersion }}
            </v-chip>
          </v-expand-x-transition>
        </v-layout>
      </v-flex>
      <v-flex xs12>
        <v-tabs v-model="active" mandatory color="transparent" dark :slider-color="barColor">
          <v-tab>
            {{ $t('version.locals') }}
          </v-tab>
          <v-tab>
            Minecraft
          </v-tab>
          <v-tab>
            Forge
          </v-tab>
          <v-tab>
            Liteloader
          </v-tab>
        </v-tabs>
        <v-tabs-items v-model="active" color="transparent" dark slider-color="primary" style="height: 70vh; overflow-y: auto"
                      @mousewheel.stop>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <local-version-list :filter-text="filterText" :selected="localVersion" @value="selectLocalVersion" />
          </v-tab-item>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <v-list-tile style="margin: 0px 0;">
              <v-checkbox v-model="showAlpha" :label="$t('minecraft.showAlpha')" />
            </v-list-tile>
            <v-divider dark />
            <minecraft-version-list :filter="filterMinecraft" style="background-color: transparent;"
                                    :mcversion="mcversion" :selected="mcversion" @value="mcversion = $event.id" />
          </v-tab-item>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <v-list-tile>
              <v-checkbox v-model="recommendedAndLatestOnly" :label="$t('forge.recommendedAndLatestOnly')" />
              <v-spacer />
              <v-checkbox v-model="showBuggy" :label="$t('forge.showBuggy')" />
            </v-list-tile>
            <v-divider dark />
            <forge-version-list style="background-color: transparent" :refreshing="$repo.state.version.refreshingForge" :version-list="forgeVersionList"
                                :mcversion="mcversion" :filter="filterForge" @refresh="refreshForgeVersion" @value="forgeVersion = $event ? $event.version : ''" />
          </v-tab-item>
          <v-tab-item style="height: 100%" @mousewheel.stop>
            <liteloader-version-list :mcversion="mcversion" :filter-text="filterText" @value="liteloaderVersion = $event ? $event.version : ''" />
          </v-tab-item>
        </v-tabs-items>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import { createComponent, reactive, computed, ref, onMounted, onUnmounted, toRefs, provide } from '@vue/composition-api';
import { useAutoSaveLoad, useCurrentProfile, useForgeVersions } from '@/hooks';
import Vue from 'vue';

export default createComponent({
  setup() {
    provide('filter-text', ref(''));
    const data = reactive({
      active: 0,
      searchPanel: false,
      filterText: '',

      showAlpha: false,
      showBuggy: false,
      recommendedAndLatestOnly: true,

      mcversion: '',
      forgeVersion: '',
      liteloaderVersion: '',
    });
    const refs = toRefs(data);
    const { edit, version } = useCurrentProfile();
    const { list, refresh, refreshing } = useForgeVersions(refs.mcversion);
    const barColor = computed(() => {
      switch (data.active) {
        case 0: return 'white';
        case 1: return 'primary';
        case 2: return 'brown';
        case 3: return 'cyan';
        default: return 'primary';
      }
    });
    function save() {
      edit({
        version: {
          minecraft: data.mcversion,
          forge: data.forgeVersion,
          liteloader: data.liteloaderVersion,
        },
      });
    }
    async function load() {
      const { forge, minecraft, liteloader } = version.value;
      data.mcversion = minecraft;
      data.forgeVersion = forge;
      data.liteloader = liteloader;
    }

    useAutoSaveLoad(save, load);

    function filterMinecraft(v) {
      if (!data.showAlpha && v.type !== 'release') return false;
      return v.id.indexOf(data.filterText) !== -1;
    }
    function filterForge(version) {
      if (data.recommendedAndLatestOnly && version.type !== 'recommended' && version.type !== 'latest') return false;
      if (data.showBuggy && version.type !== 'buggy') return true;
      return version.version.indexOf(data.filterText) !== -1;
    }
    function selectLocalVersion(v) {
      data.mcversion = v.minecraft;
      Vue.nextTick().then(() => {
        data.forgeVersion = v.forge;
        data.liteloaderVersion = v.liteloader;
      });
    }

    return {
      forgeVersionList: list,
      refresh,
      refreshing,
      filterMinecraft,
      filterForge,
    };
  },
  computed: {
    localVersion() { return { minecraft: this.mcversion, forge: this.forgeVersion, liteloader: this.liteloaderVersion }; },
  },
  watch: {
    mcversion() {
      this.forgeVersion = '';
      this.liteloaderVersion = '';
    },
  },
});
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important;
}
</style>
