<template>
  <v-container
    grid-list-xs
    fill-height
    class="resource-pack-page"
    style="overflow: auto"
  >
    <v-layout
      row
      wrap
    >
      <v-toolbar
        dark
        flat
        dense
        color="transparent"
        style="z-index: 10"
      >
        <v-toolbar-title>{{ $tc("resourcepack.name", 2) }}</v-toolbar-title>
        <v-spacer />
        <!-- <v-tooltip bottom> -->
        <!-- <template v-slot:activator="{ on }"> -->

        <!-- </template> -->
        <!-- {{ filterInCompatible ? $t('mod.showIncompatible') : $t('mod.hideIncompatible') }} -->
        <!-- </v-tooltip> -->
        <v-flex xs5>
          <v-text-field
            ref="searchBar"
            v-model="filterText"
            color="primary"
            class="focus-solo"
            append-icon="filter_list"
            :label="$t('filter')"
            dark
            hide-details
          />
        </v-flex>
        <v-btn
          style="margin-top: 12px; margin-bottom: 0; margin-left: 15px"
          icon
          @click="showFolder()"
        >
          <v-icon>folder</v-icon>
        </v-btn>
        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn
              icon
              style="margin-top: 12px; margin-bottom: 0;"
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
        <v-btn
          icon
          style="margin-top: 12px; margin-bottom: 0"
          @click="goPreview"
        >
          <span class="material-icons-outlined icon-image-preview">
            preview
          </span>
        </v-btn>
      </v-toolbar>

      <!-- <v-flex
        tag="h1"
        class="white--text"
        xs7
      >
        <span class="headline">{{ $tc('resourcepack.name', 2) }}</span>
      </v-flex>
      -->
      <v-flex
        d-flex
        xs6
        style="padding-right: 5px"
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
              style="width: 100%; font-size: 16px"
            >{{
              $t("resourcepack.unselected")
            }}</span>
          </v-card-title>
          <hint
            v-if="unselectedItems.length === 0"
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
                v-for="item in unselectedItems"
                :key="item.id"
                :pack="item"
                :is-selected="false"
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
              style="width: 100%; font-size: 16px"
            >{{
              $t("resourcepack.selected")
            }}</span>
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
                :key="item.id"
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
</template>

<script lang=ts>
import { defineComponent, reactive, inject, ref, toRefs, computed, Ref, onUnmounted } from '@vue/composition-api'
import {
  useInstanceResourcePacks,
  useResourceOperation,
  useDragTransferList,
  useDropImport,
  ResourcePackItem,
  useRouter,
  useService,
  useInstanceBase,
} from '/@/hooks'
import ResourcePackCard from './ResourcePackSettingPageCard.vue'
import { useSearch, useSearchToggle } from '../hooks'
import { BaseServiceKey } from '/@shared/services/BaseService'

export default defineComponent({
  components: {
    ResourcePackCard,
  },
  setup() {
    const { text: filterText } = useSearch()
    const rightList: Ref<any> = ref(null)
    const leftList: Ref<any> = ref(null)
    const { enabled, disabled, add, remove, commit, insert } = useInstanceResourcePacks()
    const { removeResource } = useResourceOperation()
    const { replace } = useRouter()
    const { path } = useInstanceBase()
    const { openDirectory } = useService(BaseServiceKey)
    const searchBar: Ref<any> = ref(null)
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
    useSearchToggle(() => searchBar.value?.focus())
    useDropImport(leftListElem, 'resourcepacks')
    useDropImport(rightListElem, 'resourcepacks')

    onUnmounted(commit)

    function filterName(r: ResourcePackItem) {
      if (!filterText.value) return true
      return r.name.toLowerCase().indexOf(filterText.value.toLowerCase()) !== -1
    }

    const unselectedItems = computed(() => disabled.value
      .filter((a) => filterName(a)))
    const selectedItems = computed(() => enabled.value
      .filter((a) => filterName(a)))

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
      replace('/resource-pack-preview')
    }
    function goToCurseforge() {
      replace(`/curseforge/texture-packs?from=${path.value}`)
    }
    function showFolder() {
      openDirectory(`${path.value}/resourcepacks`)
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
      goPreview,
      searchBar,
      goToCurseforge,
      showFolder,
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
