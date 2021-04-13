<template>
  <v-card style="overflow: auto; max-width: 100%; max-height: 70vh; min-height: 70vh;">
    <v-card-text v-if="!loading">
      <div v-html="description" />
    </v-card-text>
    <v-container
      v-else
      fill-height
      style="min-height: 65vh;"
    >
      <v-layout
        justify-center
        align-center
        fill-height
      >
        <v-progress-circular
          indeterminate
          :size="100"
        />
      </v-layout>
    </v-container>
  </v-card>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { useCurseforgeProjectDescription } from '/@/hooks'
import { required } from '/@/util/props'

export default defineComponent<{ project: number }>({
  props: { project: required(Number) },
  setup(props) {
    const { loading, description } = useCurseforgeProjectDescription(props.project)
    return { loading, description }
  },
})
</script>

<style>
.v-image__image {
  background-repeat: no-repeat;
  background-position: center center;
}
</style>
