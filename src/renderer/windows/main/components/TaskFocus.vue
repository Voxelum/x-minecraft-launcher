<template>
  <v-container
    grid-list-xs
    fill-height
  >
    <v-layout
      row
      wrap
      justify-center
      align-center
      fill-height
    >
      <v-progress-circular
        :size="170"
        :width="15"
        :indeterminate="progress === -1"
        :value="progress / total * 100"
      >
        <div style="text-align: center;">
          {{ $t(name) }}
        </div>
      </v-progress-circular>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, computed } from '@vue/composition-api'
import { useTaskFromServiceCall } from '/@/hooks'
import { optional } from '/@/util/props'

export default defineComponent({
  props: { value: optional<Promise<any>>(Promise) },
  setup(props) {
    return useTaskFromServiceCall(computed(() => props.value))
  },
})
</script>

<style>
</style>
