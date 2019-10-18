<template>
  <v-container grid-list-xs fill-height style="overflow: auto;">
    <v-layout row wrap>
      <v-flex tag="h1" class="white--text" xs7>
        <span class="headline">{{ $tc('resourcepack.name', 2) }}</span>
      </v-flex>
      <v-flex xs5>
        <v-text-field v-model="filterText" color="primary" class="focus-solo" append-icon="filter_list"
                      :label="$t('filter')" dark hide-details />
      </v-flex>
      <v-flex d-flex xs6 style="padding-right: 5px">
        <v-card dark class="card-list" @drop="onDropLeft" @dragover="onDragOver" @mousewheel="onMouseWheel">
          <v-card-title>
            <span class="text-sm-center" style="width: 100%; font-size: 16px;"> {{ $t('resourcepack.unselected') }} </span> 
          </v-card-title>
          <hint v-if="unselectedItems.length === 0" icon="save_alt" :text="$t('resourcepack.hint')" :absolute="true" />
          <div v-else class="list">
            <resource-pack-card v-for="(pack, index) in unselectedItems"
                                :key="pack.hash" 
                                v-observe-visibility="{
                                  callback: (v) => onItemVisibile(v, index, true),
                                  once: true,
                                }" 
                                :data="pack" 
                                :is-selected="false" 
                                :index="index" 
                                @dragstart="dragging = true" 
                                @dragend="dragging = false" />
          </div>
        </v-card>
      </v-flex>
      <v-flex d-flex xs6 style="padding-left: 5px">
        <v-card dark class="card-list right" @drop="onDropRight" @dragover="onDragOver" @mousewheel="onMouseWheel">
          <v-card-title>
            <span class="text-sm-center" style="width: 100%; font-size: 16px;"> {{ $t('resourcepack.selected') }} </span> 
          </v-card-title>
          <hint v-if="selecetedItems.length === 0" icon="save_alt" :text="$t('resourcepack.hint')" :absolute="true" />
          <div v-else ref="rightList" class="list">
            <resource-pack-card v-for="(pack, index) in selecetedItems" 
                                :key="`${pack.hash}${index}`"
                                v-observe-visibility="{
                                  callback: (v) => onItemVisibile(v, index, true),
                                  once: true,
                                }" 
                                :data="pack" 
                                :is-selected="true" 
                                :index="index" />
          </div>
        </v-card>
      </v-flex>
    </v-layout>
    <v-fab-transition>
      <v-btn
        v-if="dragging"
        style="right: 40vw; bottom: 10px;"
        large
        absolute
        dark
        fab
        bottom
        color="red"
        @dragover="onDragOver" @drop="onDropDelete"
      >
        <v-icon> delete </v-icon>
      </v-btn>
    </v-fab-transition>
    <v-dialog v-model="isDeletingPack" width="400" persistance>
      <v-card>
        <v-card-title primary-title>
          <div>
            <h3 class="headline mb-0">
              {{ $t('resourcepack.deletion', { pack: deletingPack ? deletingPack.name : '' }) }}
            </h3>
            <div> {{ $t('resourcepack.deletionHint') }} </div>
          </div>
        </v-card-title>

        <v-divider />
        <v-card-actions>
          <v-btn flat @click="isDeletingPack = false; deletingPack = null">
            {{ $t('no') }}
          </v-btn>
          <v-spacer />
          <v-btn flat color="red" @click="confirmDeletingPack">
            <v-icon left>
              delete
            </v-icon>
            {{ $t('yes') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import unknownPack from 'renderer/assets/unknown_pack.png';
import { createComponent, reactive, inject, ref, toRefs, computed, onMounted } from '@vue/composition-api';
import { useSelectionList, useProfileResourcePacks, useResource } from '@/hooks';

export default createComponent({
  setup() {
    const filterText = inject('filter-text', ref(''));
    const { resourcePacks: packNames } = useProfileResourcePacks();
    const { resources, importResource, queryResource, removeResource } = useResource('resourcepacks');
    const data = reactive({
      dragging: false,
      isDeletingPack: false,
      deletingPack: null,
    });
    const resourcePacks = computed(() => {
      const packs = resources.value;
      const packnames = packNames.value;

      const selectedNames = {};
      for (const name of packNames.value) {
        selectedNames[name] = true;
      }

      const unselectedPacks = [];

      const nameToPack = {};
      for (const pack of packs) {
        nameToPack[pack.name + pack.ext] = pack;
        nameToPack[pack.name] = pack;
        if (!selectedNames[pack.name + pack.ext]) unselectedPacks.push(pack);
      }
      const selectedPacks = packNames.value
        .map(name => nameToPack[name]
          || { name, ext: '', missing: true, metadata: { packName: name, description: 'Cannot find this pack', icon: unknownPack, format: -1 } });

      return [selectedPacks, unselectedPacks];
    });
    function filterName(r) {
      if (!filterText.value) return true;
      return r.name.toLowerCase().indexOf(filterText.value.toLowerCase()) !== -1;
    }
    async function dropFile(path) {
      await importResource({ path, type: 'resourcepack' });
    }
    async function confirmDeletingPack() {
      data.isDeletingPack = false;
      data.deletingPack = null;
      removeResource(data.deletingPack.hash);
    }
    function onDropDelete(e) {
      const hash = e.dataTransfer.getData('Hash');
      const res = queryResource(hash);
      if (res) {
        data.isDeletingPack = true;
        data.deletingPack = res;
      }
    }
    return {
      ...toRefs(data),
      filterText,
      ...useSelectionList(packNames,
        () => resourcePacks.value[1].filter(filterName),
        () => resourcePacks.value[0].filter(filterName),
        dropFile,
        r => r.name + r.ext),
      confirmDeletingPack,
      onDropDelete,
    };
  },
  // async mounted() {
  //   await this.$repo.dispatch('loadProfileGameSettings');
  // },
});
</script>

<style>
</style>
