<template>
  <div
    class="flex flex-grow-0 flex-row items-center justify-center"
  >
    <template
      v-for="(i, idx) of items"
      :key="i.title"
    >
      <AvatarItem
        :icon="i.icon"
        :title="i.title"
        :text="i.text"
        :color="i.color"
        :avatar="i.avatar"
        :responsive="i.responsive"
        :onclick="i.onclick"
      />
      <v-divider
        v-if="idx < items.length - 1"
        vertical
        class="mx-1 opacity-30"
      />
    </template>
  </div>
</template>
<script lang="ts" setup>
import AvatarItem, { AvatarItemProps } from './AvatarItem.vue'

defineProps<{ items: AvatarItemProps[] }>()
</script>
