<template>
  <v-list-tile @click="source.onClick">
    <v-list-tile-content>
      <v-list-tile-title>{{ name }}</v-list-tile-title>
      <v-list-tile-sub-title>{{ variantsCount }} variants </v-list-tile-sub-title>
    </v-list-tile-content>
  </v-list-tile>
</template>

<script lang=ts>
import { defineComponent, reactive, toRefs, onMounted, computed } from '@vue/composition-api'
import { BlockStateJson } from '@main/service/ResourcePackPreviewService'
import { required } from '/@/util/props'

export default defineComponent({
  props: { source: required< BlockStateJson & { onClick(): void }>(Object) },
  setup(props) {
    return {
      name: computed(() => props.source.name.substring(0, props.source.name.length - 5)),
      variantsCount: computed(() => (props.source.variants ? Object.keys(props.source.variants).length : 0)),
    }
  },
})
</script>
