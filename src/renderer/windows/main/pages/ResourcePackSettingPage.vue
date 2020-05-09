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
        <v-card ref="leftList" dark class="card-list" @drop="dragging = false">
          <v-card-title>
            <span class="text-sm-center" style="width: 100%; font-size: 16px;"> {{ $t('resourcepack.unselected') }} </span> 
          </v-card-title>
          <hint 
            v-if="unselectedItems.length === 0" 
            icon="save_alt" 
            :text="$t('resourcepack.hint')" 
            :absolute="true" 
            style="height: 100%" />
          <div v-else class="list">
            <resource-pack-card v-for="(item, index) in unselectedItems"
                                :key="item[0].hash" 
                                v-observe-visibility="{
                                  callback: (v) => onLeftSeen(v, index),
                                  once: true,
                                }" 
                                :data="item[0]" 
                                :is-selected="false" 
                                :index="item[1]" 
                                @dragstart="dragging = true"
                                @dragend="dragging = false" 
                                @mouseup="dragging = false"
            />
          </div>
        </v-card>
      </v-flex>
      <v-flex d-flex xs6 style="padding-left: 5px">
        <v-card ref="rightList" dark class="card-list right" @drop="dragging = false">
          <v-card-title>
            <span class="text-sm-center" style="width: 100%; font-size: 16px;"> {{ $t('resourcepack.selected') }} </span> 
          </v-card-title>
          <hint 
            v-if="selectedItems.length === 0" 
            icon="save_alt" 
            :text="$t('resourcepack.hint')" 
            :absolute="true"
            style="height: 100%" />
          <div v-else ref="rightList" class="list">
            <resource-pack-card v-for="(item, index) in selectedItems" 
                                :key="item[0].hash"
                                v-observe-visibility="{
                                  callback: (v) => onRightSeen(v, index),
                                  once: true,
                                }" 
                                :data="item[0]" 
                                :is-selected="true" 
                                :index="item[1]" 
                                @dragstart="dragging = true"
                                @dragend="dragging = false" 
                                @mouseup="dragging = false" />
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
        @dragover.prevent
        @drop="onDropDelete"
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

<script lang=ts>
import { defineComponent, reactive, inject, ref, toRefs, computed, Ref, onUnmounted } from '@vue/composition-api';
import { ResourcePackResource, Resource } from '@universal/store/modules/resource';
import {
  useInstanceResourcePacks,
  useResourceOperation,
  useDragTransferList,
  useProgressiveLoad,
  useDropImport,
} from '@/hooks';
import ResourcePackCard from './ResourcePackSettingPageCard.vue';

export default defineComponent({
  components: {
    ResourcePackCard,
  },
  setup() {
    const filterText = inject('filter-text', ref(''));
    const rightList: Ref<null | Vue> = ref(null);
    const leftList: Ref<null | Vue> = ref(null);
    const { usedPackResources, unusedPackResources, add, remove, commit, swap } = useInstanceResourcePacks();
    const { getResource, removeResource } = useResourceOperation();
    const data = reactive({
      dragging: false,
      isDeletingPack: false,
      deletingPack: null as ResourcePackResource | null,
    });
    const leftListElem = computed(() => leftList.value?.$el) as Ref<HTMLElement>;
    const rightListElem = computed(() => rightList.value?.$el) as Ref<HTMLElement>;
    useDragTransferList(
      leftListElem,
      rightListElem,
      swap,
      (index) => { add(unusedPackResources.value[index]); },
      remove,
    );
    useDropImport(leftListElem, 'resourcepacks');
    useDropImport(rightListElem, 'resourcepacks');

    onUnmounted(commit);
    
    const { filter: filterLeft, onItemVisibile: onLeftSeen } = useProgressiveLoad();
    const { filter: filterRight, onItemVisibile: onRightSeen } = useProgressiveLoad();

    function filterName(r: Resource<any>) {
      if (!filterText.value) return true;
      return r.name.toLowerCase().indexOf(filterText.value.toLowerCase()) !== -1;
    }

    const unselectedItems = computed(() => unusedPackResources.value
      .map((r, i) => [r, i] as const)
      .filter((a) => filterName(a[0]))
      .filter(filterLeft));
    const selectedItems = computed(() => usedPackResources.value
      .map((r, i) => [r, i] as const)
      .filter((a) => filterName(a[0]))
      .filter(filterRight));

    async function confirmDeletingPack() {
      data.isDeletingPack = false;
      removeResource(data.deletingPack!.hash);
      data.deletingPack = null;
    }
    function onDropDelete(e: DragEvent) {
      const hash = e.dataTransfer!.getData('hash');
      const res = getResource(hash);
      if (res.type !== 'unknown') {
        data.isDeletingPack = true;
        data.deletingPack = res as ResourcePackResource;
      }
    }
    return {
      ...toRefs(data),
      unselectedItems,
      selectedItems,
      leftList,
      rightList,
      filterText,
      confirmDeletingPack,
      onDropDelete,
      onLeftSeen,
      onRightSeen,
    };
  },
  // async mounted() {
  //   await this.$repo.dispatch('loadProfileGameSettings');
  // },
});
</script>

<style>
</style>
