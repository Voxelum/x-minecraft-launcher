<template>
  <v-chip
    label
    variant="outlined"
    :small="small"
    @click="emit('click')"
  >
    <v-avatar :start="true">
      <img
        :src="avatar"
      >
    </v-avatar>
    <div v-if="text">
      {{ text }}
    </div>
  </v-chip>
</template>
<script lang="ts" setup>
defineProps<{
  small?: boolean
  avatar?: string
  text?: string
}>()
const emit = defineEmits(['click'])
</script>
