<template>
  <div
    class="flex flex-grow-0 flex-row items-center justify-center gap-1"
  >
    <template
      v-for="(i) of items"
    >
      <AvatarItem
        :key="i.title"
        :icon="i.icon"
        :title="i.title"
        :text="i.text"
        :color="i.color"
        :avatar="i.avatar"
      />
      <v-divider
        v-if="i !== items[items.length - 1]"
        :key="i.title + 'divider'"
        vertical
      />
    </template>
  </div>
</template>
<script lang="ts" setup>
import AvatarItem from './AvatarItem.vue'

defineProps<{ items: {
  small?: boolean
  color?: string
  avatar?: string
  icon?: string
  title?: string
  text?: string
}[] }>()
</script>
