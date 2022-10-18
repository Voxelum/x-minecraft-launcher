<template>
  <v-list-item @click="source.onClick">
    <v-list-item-content>
      <v-list-item-title>{{ name }}</v-list-item-title>
      <v-list-item-subtitle>{{ variantsCount }} variants </v-list-item-subtitle>
    </v-list-item-content>
  </v-list-item>
</template>

<script lang=ts>
import { BlockStateJson } from '@xmcl/runtime-api'
import { required } from '@/util/props'

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
