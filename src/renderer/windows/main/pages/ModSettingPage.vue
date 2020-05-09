<template>
  <v-container fill-height style="overflow: auto;" @dragend="draggingMod = false">
    <v-layout row wrap fill-height>
      <v-toolbar dark flat>
        <v-toolbar-title>{{ $tc('mod.name', 2) }}</v-toolbar-title>
        <v-spacer />
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn
              icon
              v-on="on"
              @click="filterInCompatible = !filterInCompatible"
            >
              <v-icon>
                {{ filterInCompatible ? 'visibility' : 'visibility_off' }}
              </v-icon>
            </v-btn>
          </template>
          {{ filterInCompatible ? $t('mod.showIncompatible') : $t('mod.hideIncompatible') }}
        </v-tooltip>
        <v-tooltip bottom>
          <template v-slot:activator="{ on }">
            <v-btn icon v-on="on" @click="toggle[0]()">
              <v-icon>search</v-icon>
            </v-btn>
          </template>
          {{ $t('filter') }}
        </v-tooltip>
      </v-toolbar>
      <v-flex d-flex xs6 style="padding-right: 5px;">
        <v-card ref="leftList" dark class="card-list" @dragover.prevent>
          <v-card-title>
            <span
              v-if="filterModId === ''"
              class="text-sm-center"
              style="width: 100%; font-size: 16px;"
            >{{ $t('mod.unselected') }}</span>
            <v-chip
              v-else
              outline
              color="white"
              class="text-sm-center"
              close
              label
              @input="filterModId = ''"
            >modid = {{ filterModId }}</v-chip>
          </v-card-title>
          <hint
            v-if="unselectedItems.length === 0"
            icon="save_alt"
            :text="$t('mod.hint')"
            :absolute="true"
            style="height: 100%"
          />
          <div v-else class="list">
            <mod-card
              v-for="item in unselectedItems"
              :key="item.url"
              :mod="item"
              :is-selected="false"
              @dragstart="draggingMod = true"
              @dragend="draggingMod = false"
              @click="setFilteredModid(item)"
            />
          </div>
        </v-card>
      </v-flex>
      <v-flex d-flex xs6 style="padding-left: 5px;" @drop="draggingMod=false">
        <v-card ref="rightList" dark class="card-list right">
          <v-card-title>
            <span
              class="text-sm-center"
              style="width: 100%; font-size: 16px;"
            >{{ $t('mod.selected') }}</span>
          </v-card-title>
          <hint
            v-if="selectedItems.length === 0"
            icon="save_alt"
            :text="$t('mod.hint')"
            :absolute="true"
            style="height: 100%"
          />
          <div v-else class="list">
            <mod-card
              v-for="item in selectedItems"
              :key="item.url"
              :mod="item"
              :is-selected="true"
            />
          </div>
        </v-card>
      </v-flex>
    </v-layout>
    <delete-button :drop="onDropMod" :visible="draggingMod" />
    <v-dialog :value="!!deletingMod" width="400" persistance>
      <delete-view
        :confirm="() => removeModResource(true)"
        :cancel="() => removeModResource(false)"
        :name="deletingMod ? deletingMod.name : ''"
      />
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs, computed, ref, Ref, watch } from '@vue/composition-api';
import { ForgeResource, LiteloaderResource } from '@universal/store/modules/resource';
import {
  useInstanceMods,
  useDragTransferList,
  useResourceOperation,
  useInstanceVersionBase,
  useDropImport,
  useDropImportFile,
  ModItem,
} from '@/hooks';
import { isCompatible } from '@universal/util/version';
import { useNotifier, useSearchToggle, useSearch } from '../hooks';
import ModCard from './ModSettingPageCard.vue';
import DeleteView from './ModSettingPageDeleteView.vue';
import DeleteButton from './ModSettingPageDeleteButton.vue';

type ModResource = ForgeResource | LiteloaderResource;

export default defineComponent({
  components: {
    ModCard,
    DeleteView,
    DeleteButton,
  },
  setup() {
    const data = reactive({
      filterInCompatible: true,
      filterModId: '',

      draggingMod: false,
      deletingMod: null as ModItem | null,
    });
    const rightList: Ref<null | Vue> = ref(null);
    const leftList: Ref<null | Vue> = ref(null);
    const { minecraft } = useInstanceVersionBase();
    const { mods, unusedMods } = useInstanceMods();
    const { removeResource, importUnknownResource } = useResourceOperation();
    const { subscribe } = useNotifier();
    const { toggle } = useSearchToggle();
    const { text: filteredText } = useSearch();

    useDropImport(computed(() => leftList.value?.$el as HTMLElement), 'mods');
    useDropImportFile(computed(() => rightList.value?.$el as HTMLElement), (file) => {
      let promise = importUnknownResource({ path: file.path, type: 'mods' });
      subscribe(promise, () => `Import ${file.path}`, () => `Import ${file.path}`);
    });

    function add(mod: string) {
      let found = unusedMods.value.find(m => m.url === mod);
      if (found) {
        mods.value.push(found);
      }
    }
    function remove(mod: string) {
      mods.value = mods.value.filter(m => m.url !== mod);
    }

    useDragTransferList(
      computed(() => leftList.value?.$el) as any,
      computed(() => rightList.value?.$el) as any,
      () => { },
      add,
      remove,
    );

    function filterText(mod: ModItem) {
      const text = filteredText.value;
      if (!text) return true;
      return mod.name.toLowerCase().indexOf(text.toLowerCase()) !== -1;
    }
    function isCompatibleMod(mod: ModItem) {
      if (data.filterInCompatible) {
        return isCompatible(mod.acceptMinecraft, minecraft.value);
      }
      return true;
    }
    function isDuplicated(list: ModItem[], mod: ModItem) {
      if (data.filterModId) {
        if (mod.id === data.filterModId) {
          list.push(mod);
        }
        return list;
      }
      if (!list.find(v => v.id === mod.id && v.type === mod.type)
        && !mods.value.find(v => v.id === mod.id && v.type === mod.type)) {
        list.push(mod);
      }
      return list;
    }

    // const { filter: filterLeft, onItemVisibile: onLeftSeen } = useProgressiveLoad();
    // const { filter: filterRight, onItemVisibile: onRightSeen } = useProgressiveLoad();

    const unselectedItems = computed(() => unusedMods.value
      .filter(filterText)
      .filter(isCompatibleMod)
      .reduce(isDuplicated, [] as ModItem[]),
    );

    const selectedItems = computed(() => mods.value
      .filter(filterText));

    watch(selectedItems, () => {
      console.log(selectedItems.value);
    });

    function commitModRemove(confirm: boolean) {
      if (confirm) {
        if (data.deletingMod) {
          if (data.deletingMod.resource) {
            removeResource(data.deletingMod.resource);
          }
        }
      }
      data.deletingMod = null;
    }
    function onDropMod(e: DragEvent) {
      const url = e.dataTransfer!.getData('id');
      const target = mods.value.find(m => m.url === url);
      data.deletingMod = target ?? null;
    }

    function setFilteredModid(mod: ModItem) {
      data.filterModId = mod.id;
    }
    return {
      ...toRefs(data),
      rightList,
      leftList,
      // onLeftSeen,
      // onRightSeen,
      unselectedItems,
      selectedItems,
      commitModRemove,
      onDropMod,
      setFilteredModid,
      toggle,
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
