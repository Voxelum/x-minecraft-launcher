<template>
  <div class="h-full flex overflow-auto">
    <v-card-text
      v-if="!loading"
      class="overflow-auto"
    >
      <div
        class="overflow-auto"
        v-html="description"
      />
    </v-card-text>
    <v-card-text
      v-else
      class="overflow-auto"
    >
      <v-skeleton-loader type="heading, list-item, paragraph, card, sentences, image, paragraph, paragraph" />
    </v-card-text>
  </div>
</template>

<script lang=ts>
import { required } from '/@/util/props'
import { useCurseforgeProjectDescription } from '../composables/curseforge'

export default defineComponent({
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
