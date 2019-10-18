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
        <v-card dark class="card-list" @mousewheel="onMouseWheel">
          <v-card-title>
            <span v-if="filteringModId === ''" class="text-sm-center" style="width: 100%; font-size: 16px;"> 
              {{ $t('mod.unselected') }}
            </span>
            <v-chip v-else outline color="white" class="text-sm-center" close label @input="filteringModId = ''">
              modid = {{ filteringModId }}
            </v-chip>
          </v-card-title>
          <hint v-if="mods[1].length === 0" icon="save_alt" :text="$t('mod.hint')" :absolute="true" />
          <div v-else class="list" @drop="onDropLeft" @dragover="onDragOver">
            <mod-card v-for="(mod, index) in unselectedItems" 
                      :key="mod.hash"
                      v-observe-visibility="{
                        callback: (v) => onItemVisibile(v, index, false),
                        once: true,
                      }" 
                      :data="mod" :index="index" 
                      :hash="mod.hash"
                      :is-selected="false"
                      @dragstart="draggingMod = true"
                      @dragend="draggingMod = false"
                      @click="filterByModId(mod)" />
          </div>
        </v-card>
      </v-flex>
      <v-flex d-flex xs6 style="padding-left: 5px;">
        <v-card dark class="card-list right" style="display: flex; flex-flow: column;" @drop="onDropRight" @dragover="onDragOver" @mousewheel="onMouseWheel">
          <v-card-title>
            <span class="text-sm-center" style="width: 100%; font-size: 16px;"> {{ $t('mod.selected') }} </span> 
          </v-card-title>
          <hint v-if="mods[0].length === 0" icon="save_alt" :text="$t('mod.hint')" :absolute="true" />
          <div v-else ref="rightList" class="list">
            <mod-card v-for="(mod, index) in selecetedItems" 
                      :key="mod.hash" 
                      v-observe-visibility="{
                        callback: (v) => onItemVisibile(v, index, true),
                        once: true,
                      }" 
                      :data="mod" :index="index" :hash="mod.hash"
                      :is-selected="true" />
          </div>
        </v-card>
      </v-flex>
    </v-layout>
    <v-fab-transition>
      <v-btn
        v-if="draggingMod"
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
    <v-dialog v-model="isDeletingMod" width="400" persistance>
      <v-card>
        <v-card-title primary-title>
          <div>
            <h3 class="headline mb-0">
              {{ $t('mod.deletion', { mod: deletingMod? deletingMod.name:'' }) }}
            </h3>
            <div> {{ $t('mod.deletionHint') }} </div>
          </div>
        </v-card-title>

        <v-divider />
        <v-card-actions>
          <v-btn flat @click="isDeletingMod = false; deletingMod = null">
            {{ $t('no') }}
          </v-btn>
          <v-spacer />
          <v-btn flat color="red" @click="onConfirmDeleteMod">
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
import { createComponent, reactive, toRefs, computed, ref } from '@vue/composition-api';
import { useProfileMods, useSelectionList, useResource } from '@/hooks';

export default createComponent({
  setup() {
    const data = reactive({
      filterInCompatible: true,
      filterNonMatchedMinecraftVersion: false,
      filterText: '',
      filteringModId: '',

      draggingMod: false,

      isDeletingMod: false,
      deletingMod: null,
    });
    const { mods: items } = useProfileMods();
    const { resources, queryResource, importResource, removeResource } = useResource('mods');
    const mods = computed(() => {
      const mods = resources.value;
      const selectedModUrls = items.value;
      const selectedMods = selectedModUrls.map(s => queryResource(s)
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
    });
    function filterMod(text, mod) {
      if (!text) return true;
      return mod.name.toLowerCase().indexOf(text.toLowerCase()) !== -1;
    }
    function onConfirmDeleteMod() {
      data.isDeletingMod = false;
      removeResource(data.deletingMod.hash);
      data.deletingMod = null;
    }
    function onDropDelete(e) {
      const hash = e.dataTransfer.getData('Hash');
      const res = queryResource(hash);
      if (res) {
        data.isDeletingMod = true;
        data.deletingMod = res;
      }
    }
    function filterByModId(modRes) {
      data.filteringModId = modRes.metadata[0].modid;
    }
    function dropFile(path) {
      importResource({ path }).catch((e) => { console.error(e); });
    }
    return {
      ...toRefs(data),
      ...useSelectionList(
        items,
        () => mods.value[1]
          .filter(data.filteringModId !== ''
            ? m => m.metadata[0].modid === data.filteringModId
            : (m => filterMod(data.filterText, m))),
        () => mods.value[0]
          .filter(m => filterMod(data.filterText, m)),
        dropFile,
        i => i.hash,
      ),
      onDropDelete,
      filterByModId,
      mods,
      onConfirmDeleteMod,
    };
  },
});
</script>
<style scoped=true>
</style>
