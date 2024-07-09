<template>
  <v-list
    color="transparent"
    class="w-200 stepper-select mx-auto flex flex-grow-0 flex-col gap-2 px-2"
    three-line
  >
    <v-list-item
      v-for="item of items"
      :key="item.value"
      class="rounded-lg"
      @click="emit('select', item.value)"
    >
      <v-list-item-avatar class="self-center">
        <v-img :src="item.icon" />
      </v-list-item-avatar>

      <v-list-item-content>
        <v-list-item-title>{{ item.title }}</v-list-item-title>
        <v-list-item-subtitle v-if="item.subtitle">
          {{ item.subtitle }}
        </v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action class="self-center">
        <v-icon>
          arrow_right
        </v-icon>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>
<script setup lang="ts">
import { CreateInstanceManifest } from '@xmcl/runtime-api'

const emit = defineEmits(['select'])
const props = defineProps<{
  manifests: CreateInstanceManifest[]
}>()

const items = computed(() => {
  return props.manifests.map(m => ({
    title: m.options.name,
    icon: m.options.icon,
    subtitle: m.options.description ?? m.path,
    value: m,
  }))
})

</script>
<style>
.stepper-select .v-list-item--link:before {
  @apply rounded-lg;
}
</style>
