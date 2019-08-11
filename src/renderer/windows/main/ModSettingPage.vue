<template>
  <v-container grid-list-xs fill-height style="overflow: auto;">
    <v-layout row wrap fill-height>
      <v-flex tag="h1" style="margin-bottom: 10px; padding: 6px; 8px;" class="white--text" xs7>
        <span class="headline">{{ $tc('mod.name', 2) }}</span>
      </v-flex>
      <v-flex xs5>
        <v-text-field v-model="filterText" color="primary" class="focus-solo" append-icon="filter_list"
                      :label="$t('filter')" dark hide-details />
      </v-flex>
      <v-flex d-flex xs6 style="padding-right: 5px;">
        <v-card dark class="card-list" @drop="onDropLeft" @dragover="onDragOver" @mousewheel="onMouseWheel">
          <v-card-title>
            <span v-if="filteringSpecModVersion === ''" class="text-sm-center" style="width: 100%; font-size: 16px;"> 
              {{ $t('mod.unselected') }} 
            </span>
            <v-chip v-else outline color="white" class="text-sm-center" close label @input="filteringSpecModVersion = ''">
              {{ $t('mod.backToAllMods') }}
            </v-chip>
          </v-card-title>
          <p v-if="mods[1].length === 0" class="text-xs-center headline"
             style="position: absolute; top: 120px; right: 0px; user-select: none;">
            <v-icon style="font-size: 50px; display: block;">
              save_alt
            </v-icon>
            {{ $t('mod.hint') }}
          </p>
          <div class="list">
            <mod-card v-for="(mod, index) in unselectedMods" :key="mod.hash" v-observe-visibility="{
                        callback: (v) => checkBuffer(v, index, false),
                        once: true,
                      }" :data="mod" :is-selected="false"
                      :index="index" :hash="mod.hash" @click="showOnlyThisMod(mod)" />
          </div>
        </v-card>
      </v-flex>
      <v-flex d-flex xs6 style="padding-left: 5px;">
        <v-card dark class="card-list right" @drop="onDropRight" @dragover="onDragOver" @mousewheel="onMouseWheel">
          <v-card-title>
            <span class="text-sm-center" style="width: 100%; font-size: 16px;"> {{ $t('mod.selected') }} </span> 
          </v-card-title>
          <p v-if="mods[0].length === 0" class="text-xs-center headline"
             style="position: absolute; top: 120px; right: 0px; user-select: none;">
            <v-icon style="font-size: 50px; display: block;">
              save_alt
            </v-icon>
            {{ $t('mod.hint') }}
          </p>
          <div class="list">
            <mod-card v-for="(mod, index) in selectedMods" :key="mod.hash" v-observe-visibility="{
                        callback: (v) => checkBuffer(v, index, true),
                        once: true,
                      }" :data="mod"
                      :is-selected="true" :index="index" :hash="mod.hash" />
          </div>
        </v-card>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import Vue from 'vue';
import unknownPack from 'renderer/assets/unknown_pack.png';
import SelectionList from './mixin/SelectionList';

export default {
  mixins: [SelectionList],
  data() {
    return {
      refreshing: false,
      filterInCompatible: true,
      filterNonMatchedMinecraftVersion: false,
      filterText: '',

      filteringSpecModVersion: '',
    };
  },
  computed: {
    profile() { return this.$repo.getters.selectedProfile; },

    unselectedMods() {
      if (this.filteringSpecModVersion !== '') {
        return this.mods[1].filter(m => m.metadata[0].modid === this.filteringSpecModVersion);
      }
      return this.mods[1]
        .filter(m => this.filterMod(this.filterText, m))
        .filter((_, i) => i < this.unselectedBuffer);
    },
    selectedMods() {
      return this.mods[0].filter(m => this.filterMod(this.filterText, m)).filter((_, i) => i < this.selectedBuffer);
    },
    items: {
      get() {
        return this.profile.deployments.mods || [];
      },
      set(nv) {
        this.$repo.dispatch('editProfile', { deployments: { mods: nv } });
      },
    },
    unselectedItems() {
      return this.unselectedMods;
    },
    selecetedItems() {
      return this.selectedMods;
    },
    mods() {
      const mods = this.$repo.getters.mods;
      const selectedModUrls = this.items;
      const selectedMods = selectedModUrls.map(s => this.$repo.getters.queryResource(s)
        || { id: s, missing: true, metadata: [{ name: 'missing' }] });
      const selectedMask = {};
      selectedMods.forEach((m) => {
        if (!m.missing) {
          selectedMask[m.hash] = true;
        }
      });
      const unselectedMods = mods.filter(m => !selectedMask[m.hash]);
      Object.freeze(selectedMods);
      Object.freeze(unselectedMods);
      return [selectedMods, unselectedMods];
    },
  },
  mounted() {
  },
  methods: {
    showOnlyThisMod(modRes) {
      this.filteringSpecModVersion = modRes.metadata[0].modid;
    },
    dropFile(path) {
      this.$repo.dispatch('importResource', { path }).catch((e) => { console.error(e); });
    },
    filterMod(text, mod) {
      if (!text) return true;
      return mod.name.toLowerCase().indexOf(text.toLowerCase()) !== -1;
    },
  },
};
</script>
<style scoped=true>
</style>
