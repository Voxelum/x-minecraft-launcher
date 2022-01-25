<template>
  <div class="flex flex-col max-h-full h-full">
    <div class="header-bar z-10">
      <div class="headline align-middle self-center pl-2">
        {{ $tc("resourcepack.name", 2) }}
      </div>
      <v-spacer />
      <filter-combobox
        :label="$t('resourcepack.filter')"
        class="max-w-150 mr-2"
      />
      <v-btn
        icon
        @click="showFolder()"
      >
        <v-icon>folder</v-icon>
      </v-btn>
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            v-on="on"
            @click="goToCurseforge()"
          >
            <v-icon :size="14">
              $vuetify.icons.curseforge
            </v-icon>
          </v-btn>
        </template>
        {{ $t(`curseforge.texture-packs.description`) }}
      </v-tooltip>
      <!-- <v-btn
          icon
          style="margin-top: 12px; margin-bottom: 0"
          @click="goPreview"
        >
          <span class="material-icons-outlined icon-image-preview">
            preview
          </span>
      </v-btn>-->
    </div>

    <v-container
      grid-list-xs
      class="resource-pack-page h-full"
      style="overflow: auto"
    >
      <refreshing-tile
        v-if="loading"
        class="h-full"
      />
      <v-layout
        v-else
        row
      >
        <v-flex
          d-flex
          xs6
          class="pr-2"
        >
          <v-card
            ref="leftList"
            dark
            class="card-list"
            color="transparent"
            flat
            @drop="dragging = false"
          >
            <v-card-title
              style="
              border-color: rgba(255, 255, 255, 0.7);
              border-style: solid;
              border-width: 0 0 thin 0;
            "
            >
              <span
                class="text-sm-center"
                style="width: 100%; font-size: 16px; user-select: none;"
              >
                {{
                  $t("resourcepack.unselected")
                }}
              </span>
            </v-card-title>
            <hint
              v-if="unselectedItems.length === 0"
              icon="save_alt"
              :text="$t('resourcepack.dropHint')"
              :absolute="true"
              class="h-full"
            />
            <div
              v-else
              class="list"
              style="overflow-x: hidden"
            >
              <transition-group
                name="transition-list"
                tag="div"
              >
                <resource-pack-card
                  v-for="item in unselectedItems"
                  :key="item.path"
                  :pack="item"
                  :is-selected="false"
                  @tags="item.tags = $event"
                  @dragstart="dragging = true"
                  @dragend="dragging = false"
                  @mouseup="dragging = false"
                />
              </transition-group>
            </div>
          </v-card>
        </v-flex>
        <v-flex
          d-flex
          xs6
          style="padding-left: 5px"
        >
          <v-card
            ref="rightList"
            color="transparent"
            dark
            flat
            class="card-list right"
            @drop="dragging = false"
          >
            <v-card-title
              style="
              border-color: rgba(255, 255, 255, 0.7);
              border-style: solid;
              border-width: 0 0 thin 0;
            "
            >
              <span
                class="text-sm-center"
                style="width: 100%; font-size: 16px; user-select: none;"
              >
                {{
                  $t("resourcepack.selected")
                }}
              </span>
            </v-card-title>
            <hint
              v-if="selectedItems.length === 0"
              icon="save_alt"
              :text="$t('resourcepack.dropHint')"
              :absolute="true"
              style="height: 100%"
            />
            <div
              v-else
              class="list"
              style="overflow-x: hidden"
            >
              <transition-group
                name="transition-list"
                tag="div"
              >
                <resource-pack-card
                  v-for="item in selectedItems"
                  :key="item.path"
                  :pack="item"
                  :is-selected="true"
                  @dragstart="dragging = true"
                  @dragend="dragging = false"
                  @mouseup="dragging = false"
                />
              </transition-group>
            </div>
          </v-card>
        </v-flex>
      </v-layout>
      <v-fab-transition>
        <v-btn
          v-if="dragging"
          style="right: 40vw; bottom: 10px"
          large
          absolute
          dark
          fab
          bottom
          color="red"
          @dragover.prevent
          @drop="onDropDelete"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </v-fab-transition>
      <v-dialog
        :value="!!deletingPack"
        width="400"
        persistance
      >
        <v-card>
          <v-card-title primary-title>
            <div>
              <h3 class="headline mb-0">
                {{
                  $t("resourcepack.deletion", {
                    pack: deletingPack ? deletingPack.name : "",
                  })
                }}
              </h3>
              <div>{{ $t("resourcepack.deletionHint") }}</div>
            </div>
          </v-card-title>

          <v-divider />
          <v-card-actions>
            <v-btn
              flat
              @click="
                isDeletingPack = false;
                deletingPack = null;
              "
            >
              {{ $t("no") }}
            </v-btn>
            <v-spacer />
            <v-btn
              flat
              color="red"
              @click="confirmDeletingPack"
            >
              <v-icon left>
                delete
              </v-icon>
              {{ $t("yes") }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-container>
  </div>
</template>

<script lang=ts>
import { defineComponent, reactive, ref, toRefs, computed, Ref, onUnmounted } from '@vue/composition-api'
import {
  useInstanceResourcePacks,
  useResourceOperation,
  useDragTransferList,
  useDropImport,
  ResourcePackItem,
  useRouter,
  useInstanceBase,
  useBusy,
} from '/@/hooks'
import ResourcePackCard from './ResourcePackCard.vue'
import { useSearch } from '../../composables'
import FilterCombobox, { useFilterCombobox } from '/@/components/FilterCombobox.vue'
import Hint from '/@/components/Hint.vue'
import RefreshingTile from '/@/components/RefreshingTile.vue'

function setupFilter(disabled: Ref<ResourcePackItem[]>, enabled: Ref<ResourcePackItem[]>) {
  function getFilterOptions(item: ResourcePackItem) {
    return [
      ...item.tags.map(t => ({ type: 'tag', value: t, label: 'label' })),
    ]
  }
  const filterOptions = computed(() => disabled.value.map(getFilterOptions).concat(enabled.value.map(getFilterOptions)).reduce((a, b) => [...a, ...b], []))
  const { filter } = useFilterCombobox(filterOptions, getFilterOptions, (i) => `${i.name} ${i.description}`)
  const selectedItems = computed(() => filter(enabled.value))
  const unselectedItems = computed(() => filter(disabled.value))

  return {
    filterOptions,
    selectedItems,
    unselectedItems,
  }
}

export default defineComponent({
  components: {
    ResourcePackCard,
    FilterCombobox,
    Hint,
    RefreshingTile: RefreshingTile as any,
  },
  setup() {
    const { text: filterText } = useSearch()
    const rightList: Ref<any> = ref(null)
    const leftList: Ref<any> = ref(null)
    const loading = useBusy('loadDomain(resourcepacks:resource)')
    const { enabled, disabled, add, remove, commit, insert, showDirectory } = useInstanceResourcePacks()
    const { removeResource } = useResourceOperation()
    const { push } = useRouter()
    const { path } = useInstanceBase()
    const data = reactive({
      dragging: false,
      isDeletingPack: false,
      deletingPack: null as ResourcePackItem | null,
    })
    const leftListElem = computed(() => leftList.value?.$el) as Ref<HTMLElement>
    const rightListElem = computed(() => rightList.value?.$el) as Ref<HTMLElement>
    useDragTransferList(
      leftListElem,
      rightListElem,
      insert,
      add,
      remove,
    )
    useDropImport(leftListElem, 'resourcepacks')
    useDropImport(rightListElem, 'resourcepacks')

    onUnmounted(commit)

    function filterName(r: ResourcePackItem) {
      if (!filterText.value) return true
      return r.name.toLowerCase().indexOf(filterText.value.toLowerCase()) !== -1
    }

    const { unselectedItems, selectedItems, filterOptions } = setupFilter(computed(() => disabled.value), computed(() => enabled.value))

    async function confirmDeletingPack() {
      removeResource(data.deletingPack!.id)
      data.deletingPack = null
    }
    function onDropDelete(e: DragEvent) {
      const url = e.dataTransfer!.getData('id')
      const target = enabled.value.find(m => m.id === url) ?? disabled.value.find(m => m.id === url) ?? null
      data.deletingPack = target
    }
    function goPreview() {
      push('/resource-pack-preview')
    }
    function goToCurseforge() {
      push(`/curseforge/texture-packs?from=${path.value}`)
    }
    return {
      ...toRefs(data),
      unselectedItems,
      selectedItems,
      leftList,
      rightList,
      confirmDeletingPack,
      onDropDelete,
      goToCurseforge,
      showFolder: showDirectory,
      loading,
    }
  },
  // async mounted() {
  //   await this.$repo.dispatch('loadProfileGameSettings');
  // },
})
</script>

<style>
.card-list {
  background: transparent;
}
.resource-pack-page .list::-webkit-scrollbar {
  width: 0px;
  height: 0px;
  /* remove scrollbar space */
  /* background: transparent; */
  /* optional: just make scrollbar invisible */
}
</style>
