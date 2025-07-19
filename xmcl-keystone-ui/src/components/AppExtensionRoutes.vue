<template>
  <div
    class="flex flex-grow-0 flex-row items-center justify-center gap-1"
  >
    <template 
      v-for="(i, idx) of items"
      :key="i.to"
    >
      <v-btn
        variant="text"
        :to="i.to"
      >
        <v-icon start>
          {{ i.icon }}
        </v-icon>
        {{ i.title }}
      </v-btn>
      <v-divider
        v-if="idx !== items.length - 1"
        vertical
      />
    </template>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
  items: Array<{
    icon: string
    title: string
    to: string
  }>
}>()
const { t } = useI18n()
</script>