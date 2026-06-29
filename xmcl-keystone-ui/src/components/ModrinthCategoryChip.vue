<template>
  <v-chip
    filter
    :disabled="disabled"
    variant="outlined"
    label
    :size="small ? 'small' : undefined"
    @click="disabled || $emit('click', tag)"
  >
    <template v-if="tag.icon" #prepend>
      <v-avatar size="20" class="mr-2 modrinth-category-icon" v-html="tag.icon" />
    </template>
    {{ t('modrinth.categories.' + tag.name) }}
  </v-chip>
</template>
<script lang="ts" setup>
import type { Category } from '@xmcl/modrinth'
defineProps<{ tag: Category; disabled?: boolean; small?: boolean }>()
defineEmits(['click'])
const { t } = useI18n()
</script>

<style scoped>
.modrinth-category-icon :deep(svg) {
  width: 16px;
  height: 16px;
}
</style>
