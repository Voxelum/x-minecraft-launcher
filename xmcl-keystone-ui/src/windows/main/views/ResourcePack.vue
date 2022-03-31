<template>
  <div class="max-h-full h-full gap-2 px-8 py-4 pb-0 w-full flex flex-col">
    <v-progress-linear
      class="absolute top-0 z-10 m-0 p-0 left-0"
      :active="loading"
      height="3"
      :indeterminate="true"
    />
    <v-card
      outlined
      class="flex py-1 rounded-lg flex-shrink flex-grow-0 items-center pr-2 gap-2"
      elevation="1"
    >
      <!-- <div class="headline align-middle self-center pl-2">
        {{ $tc("resourcepack.name", 2) }}
      </div> -->
      <!-- <v-spacer /> -->
      <filter-combobox
        :label="$t('resourcepack.filter')"
        class="max-w-150 mr-2"
      />
      <div class="flex-grow" />
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
            <v-icon>
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
    </v-card>

    <div
      class="h-full overflow-auto grid grid-cols-2 gap-8"
    >
      <div
        ref="leftList"
        class="h-full overflow-auto flex flex-col"
        flat
        @drop="dragging = false"
      >
        <v-card
          outlined
          class="rounded-lg"
        >
          <v-card-title class="justify-center">
            {{
              $t("resourcepack.unselected")
            }}
          </v-card-title>
        </v-card>
        <hint
          v-if="unselectedItems.length === 0"
          icon="save_alt"
          :text="
            $t('resourcepack.dropHint')"
          class="h-full"
        />
        <transition-group
          v-else
          class="list overflow-auto flex flex-col"
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

      <div
        ref="rightList"
        class="h-full overflow-auto flex flex-col"
        flat
        @drop="dragging = false"
      >
        <v-card
          outlined
          class="rounded-lg"
        >
          <v-card-title class="w-full justify-center">
            {{
              $t("resourcepack.selected")
            }}
          </v-card-title>
        </v-card>
        <hint
          v-if="selectedItems.length === 0"
          icon="save_alt"
          :text="$t('resourcepack.dropHint')"
          class="h-full"
        />
        <transition-group
          v-else
          name="transition-list"
          tag="div"
          class="list overflow-auto flex flex-col"
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
    </div>

    <v-fab-transition>
      <v-btn
        v-if="dragging"
        style="right: 40vw; bottom: 10px"
        large
        absolute

        fab
        bottom
        color="red"
        @dragover.prevent
        @drop="onDropDelete"
      >
        <v-icon>delete</v-icon>
      </v-btn>
    </v-fab-transition>
    <delete-dialog
      :title="$t('resourcepack.deletion', { pack: deletingPack ? deletingPack.name : '' })"
      :width="400"
      persistance
      @cancel="
        isDeletingPack = false;
        deletingPack = null;
      "
      @confirm="confirmDeletingPack"
    >
      <div>{{ $t("resourcepack.deletionHint") }}</div>
      <span class="text-gray-500">
        {{ deletingPack ? deletingPack.resource ? deletingPack.resource.path : '' : '' }}
      </span>
    </delete-dialog>
  </div>
</template>

<script lang=ts>
import { defineComponent, reactive, ref, toRefs, computed, Ref, onUnmounted } from '@vue/composition-api'
import { useResourceOperation, useDragTransferList, useDropImport, useRouter, useBusy, useFilterCombobox } from '/@/composables'
import FilterCombobox from '/@/components/FilterCombobox.vue'
import Hint from '/@/components/Hint.vue'
import ResourcePackCard from './ResourcePackCard.vue'
import { ResourcePackItem, useInstanceResourcePacks } from '../composables/resourcePack'
import { useInstanceBase } from '../composables/instance'
import DeleteDialog from '../components/DeleteDialog.vue'
import { useDialog } from '../composables/dialog'

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
    DeleteDialog,
  },
  setup() {
    const filterText = ref('')
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
    const { show } = useDialog('deletion')
    const leftListElem = computed(() => leftList.value) as Ref<HTMLElement>
    const rightListElem = computed(() => rightList.value) as Ref<HTMLElement>
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
      show()
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
</style>
