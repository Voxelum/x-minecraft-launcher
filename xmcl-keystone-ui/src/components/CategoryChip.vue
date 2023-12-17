<template>
  <v-chip
    label
    :small="small"
    :outlined="outlined"
    @click="$emit('click')"
  >
    <v-avatar
      v-if="item.icon?.startsWith('http')"
      left
    >
      <v-img
        :src="item.icon"
      />
    </v-avatar>
    <v-avatar
      v-else-if="item.icon"
      left
      v-html="item.icon"
    />
    {{ item.text }}
  </v-chip>
</template>
<script setup lang="ts">

export interface CategoryChipProps {
  text: string
  icon?: string
}

defineProps<{
  item: CategoryChipProps
  small?: boolean
  outlined?: boolean
}>()

</script>
