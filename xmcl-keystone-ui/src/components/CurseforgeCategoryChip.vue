<template>
  <v-chip
    filter
    :disabled="disabled"
    outlined
    label
    @click="disabled || $emit('click', value)"
  >
    <v-avatar
      left
    >
      <v-img
        :src="value.iconUrl"
      />
    </v-avatar>

    {{ tCategory(value.name) }}
  </v-chip>
</template>

<script lang="ts" setup>
import type { ModCategory } from '@xmcl/curseforge'
import { useCurseforgeCategoryI18n } from '@/composables/curseforge'
defineProps<{
  disabled?: boolean
  value: ModCategory
}>()
const tCategory = useCurseforgeCategoryI18n()
defineEmits(['click'])
</script>
