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
          v-if="data.displayed"
          :value="data.displayed"
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

<script lang=ts setup>
import { BlockStateJson } from '@xmcl/runtime-api'
import { Ref } from 'vue'
import { BlockModel } from '@xmcl/resourcepack'
import Displayer from './ResourcePackPreviewDisplayer.vue'
import PreviewItem from './ResourcePackPreviewItem.vue'
import { useBlockModelPreview, useBlockStateModels } from '../composables/useBlockModelPreview'
import { injection } from '@/util/inject'
import { kInstanceVersion } from '@/composables/instanceVersion'

const text = ref('')
const { minecraft } = injection(kInstanceVersion)
const { listBlockStates, loadModel } = useBlockModelPreview()
const loading = ref(true)
let current: any
const data = reactive({
  models: [] as BlockStateJson[],
  displayed: undefined as undefined | { model: BlockModel.Resolved; textures: Record<string, { url: string }> },
})
const block: Ref<BlockStateJson | undefined> = ref(undefined)
const { selects, selected } = useBlockStateModels(block)
loading.value = true
listBlockStates(minecraft.value).then((json) => {
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

</script>
