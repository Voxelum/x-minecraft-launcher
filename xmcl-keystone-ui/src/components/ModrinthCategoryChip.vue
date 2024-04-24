<template>
  <v-chip
    filter
    :disabled="disabled"
    outlined
    label
    :small="small"
    @click="disabled || $emit('click', tag)"
  >
    <v-avatar
      v-if="tag.icon"
      left
      v-html="tag.icon"
    />
    {{ t('modrinth.categories.' + tag.name) }}
  </v-chip>
</template>
<script lang="ts" setup>
import type { Category } from '@xmcl/modrinth'
defineProps<{ tag: Category; disabled?: boolean; small?: boolean }>()
defineEmits(['click'])
const { t } = useI18n()
</script>
