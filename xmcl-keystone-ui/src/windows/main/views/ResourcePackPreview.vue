<template>
  <v-container
    grid-list-lg
    fill-height
    class="resource-pack-preview-page"
  >
    <v-layout
      v-if="!loading"
      style="height: 100%"
    >
      <v-flex
        style="height: 100%"
        xs4
      >
        <v-list style="height: 100%">
          <virtual-list
            style="height: 100%; overflow-y: auto;"
            :data-key="'name'"
            :data-sources="items"
            :data-component="PreviewItem"
          />
        </v-list>
      </v-flex>
      <v-flex xs8>
        <displayer
          v-if="displayed"
          :value="displayed"
        />
        <v-layout
          style="overflow-x: auto; max-height: 70px"
          row
          wrap
        >
          <v-flex
            v-for="item in selects"
            :key="item.name"
            xs4
          >
            <v-select
              v-model="item.value"
              :items="item.items"
              :label="item.name"
              hide-details
            />
          </v-flex>
        </v-layout>
      </v-flex>
    </v-layout>
    <refreshing-tile v-else />
  </v-container>
</template>

<script lang=ts>
import { BlockStateJson } from '@xmcl/runtime-api'
import { computed, defineComponent, reactive, ref, Ref, toRefs, watch } from '@vue/composition-api'
import { BlockModel } from '@xmcl/resourcepack'
import { useSearch } from '../../composables'
import Displayer from './Displayer.vue'
import PreviewItem from './PreviewItem.vue'
import { useBlockModelPreview, useBlockStateModels } from '/@/hooks'

export default defineComponent({
  components: { Displayer },
  props: { value: Boolean },
  setup() {
    const { text } = useSearch()
    const { listBlockStates, loadModel } = useBlockModelPreview()
    const loading = ref(true)
    let current: any
    const data = reactive({
      models: [] as BlockStateJson[],
      displayed: undefined as undefined | { model: BlockModel.Resolved; textures: Record<string, { url: string }> },
    })
    const block: Ref<BlockStateJson | undefined> = ref(undefined)
    const { selects, selected } = useBlockStateModels(block)
    watch(selected, (path, last) => {
      if (path && path !== last) {
        let model: string
        if (path instanceof Array) {
          model = path[0].model
        } else {
          model = path.model
        }
        loadModel(model).then((m) => {
          data.displayed = Object.freeze(m)
        })
      }
    })
    loading.value = true
    listBlockStates().then((json) => {
      data.models = json.map(j => Object.freeze({
        ...j,
        onClick() {
          block.value = j
        },
      })).sort((a, b) => a.name.localeCompare(b.name))
    }).finally(() => {
      loading.value = false
    })
    function filterItem(r: BlockStateJson) {
      if (!text.value) return true
      return r.name.toLowerCase().indexOf(text.value.toLowerCase()) !== -1
    }
    const items = computed(() => data.models.filter(filterItem))
    return {
      ...toRefs(data),
      loading,
      items,
      selects,
      listBlockStates,
      PreviewItem,
    }
  },
})
</script>
