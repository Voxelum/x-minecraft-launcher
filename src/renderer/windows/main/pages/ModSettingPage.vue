<template>
  <v-container grid-list-xs fill-height style="overflow: auto;" @dragend="draggingMod = false">
    <v-layout row wrap fill-height>
      <v-flex tag="h1" style="margin-bottom: 10px; padding: 6px; 8px;" class="white--text" xs7>
        <span class="headline">{{ $tc('mod.name', 2) }}</span>
      </v-flex>
      <v-flex xs5>
        <v-text-field v-model="filterText" 
                      color="primary" 
                      class="focus-solo" 
                      append-icon="filter_list"
                      :label="$t('filter')" 
                      dark 
                      hide-details />
      </v-flex>
      <v-flex d-flex xs6 style="padding-right: 5px;">
        <v-card ref="leftList" dark class="card-list" @dragover.prevent>
          <v-card-title>
            <span v-if="filteringModId === ''" class="text-sm-center" style="width: 100%; font-size: 16px;"> 
              {{ $t('mod.unselected') }}
            </span>
            <v-chip v-else outline color="white" class="text-sm-center" close label @input="filteringModId = ''">
              modid = {{ filteringModId }}
            </v-chip>
          </v-card-title>
          <hint v-if="unselectedItems.length === 0" icon="save_alt" :text="$t('mod.hint')" :absolute="true" />
          <div v-else class="list">
            <mod-card v-for="(item, index) in unselectedItems" 
                      :key="item[0].hash"
                      v-observe-visibility="{
                        callback: (v) => onLeftSeen(v, index),
                        once: true,
                      }" 
                      :data="item[0]" 
                      :index="item[1]"
                      :is-selected="false"
                      @dragstart="draggingMod = true"
                      @dragend="draggingMod = false"
                      @click="setFilteredModid(item[0])" />
          </div>
        </v-card>
      </v-flex>
      <v-flex d-flex xs6 style="padding-left: 5px;" @drop="draggingMod=false">
        <v-card ref="rightList" dark class="card-list right">
          <v-card-title>
            <span class="text-sm-center" style="width: 100%; font-size: 16px;"> {{ $t('mod.selected') }} </span> 
          </v-card-title>
          <hint v-if="selectedItems.length === 0" icon="save_alt" :text="$t('mod.hint')" :absolute="true" />
          <div v-else class="list">
            <mod-card v-for="(item, index) in selectedItems" 
                      :key="item[0].hash" 
                      v-observe-visibility="{
                        callback: (v) => onRightSeen(v, index),
                        once: true,
                      }" 
                      :data="item[0]" 
                      :index="index" 
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
        @dragover.prevent 
        @drop="onDropDelete"
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

<script lang=ts>
import Vue from 'vue';
import { createComponent, reactive, toRefs, computed, ref, Ref, onUnmounted } from '@vue/composition-api';
import { ForgeResource, LiteloaderResource } from '@universal/store/modules/resource';
import {
  useInstanceMods,
  useDragTransferList,
  useProgressiveLoad,
  useResourceOperation,
  useDropImport,
} from '@/hooks';

export default createComponent({
  setup() {
    const data = reactive({
      filterInCompatible: true,
      filterNonMatchedMinecraftVersion: false,
      filterText: '',
      filteringModId: '',

      draggingMod: false,
      isDeletingMod: false,
      deletingMod: null as ForgeResource | LiteloaderResource | null,
    });
    const rightList: Ref<null | Vue> = ref(null);
    const leftList: Ref<null | Vue> = ref(null);
    const { usedModResources, unusedModResources, add, remove, commit } = useInstanceMods();
    const { getResource, removeResource } = useResourceOperation();

    useDropImport(computed(() => leftList.value?.$el) as any, 'mods');
    useDropImport(computed(() => rightList.value?.$el) as any, 'mods');

    useDragTransferList(
      computed(() => leftList.value?.$el) as any,
      computed(() => rightList.value?.$el) as any,
      () => { },
      i => add(unusedModResources.value[i]),
      remove,
    );
    onUnmounted(commit);

    function filterText(mod: any) {
      const text = data.filterText;
      if (!text) return true;
      return mod.name.toLowerCase().indexOf(text.toLowerCase()) !== -1;
    }
    function filterForgeMod(mod: any) {
      if (data.filteringModId !== '') {
        return mod.metadata[0] ? mod.metadata[0].modid === data.filteringModId : false;
      }
      return filterText(mod);
    }

    const { filter: filterLeft, onItemVisibile: onLeftSeen } = useProgressiveLoad();
    const { filter: filterRight, onItemVisibile: onRightSeen } = useProgressiveLoad();

    const unselectedItems = computed(() => unusedModResources.value
      .map((r, i) => [r, i] as const)
      .filter((a) => filterForgeMod(a[0]))
      .filter(filterLeft));
    const selectedItems = computed(() => usedModResources.value
      .map((r, i) => [r, i] as const)
      .filter((a) => filterText(a[0]))
      .filter(filterRight));

    function onConfirmDeleteMod() {
      data.isDeletingMod = false;
      removeResource(data.deletingMod!.hash);
      data.deletingMod = null;
    }
    function onDropDelete(e: DragEvent) {
      const hash = e.dataTransfer!.getData('id');
      const res = getResource(hash);
      if (res.type !== 'unknown') {
        data.isDeletingMod = true;
        data.deletingMod = res as ForgeResource;
      }
    }
    function setFilteredModid(modRes: ForgeResource) {
      if (!modRes.metadata[0]) return;
      data.filteringModId = modRes.metadata[0].modid;
    }
    return {
      ...toRefs(data),
      rightList,
      leftList,
      onLeftSeen,
      onRightSeen,
      onDropDelete,
      unselectedItems,
      selectedItems,
      onConfirmDeleteMod,
      setFilteredModid,
    };
  },
});
</script>

<style>
.card-list.right {
  display: flex;
  flex-flow: column;
}
</style>
