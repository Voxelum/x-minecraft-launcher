<template>
  <div class="market-list-header flex gap-1 items-center px-4 py-2">
    <div class="market-list-header__count text-medium-emphasis">
      <span class="market-list-header__count-main">{{ label }}</span>
      <span
        v-if="total !== undefined && total > 0"
        class="market-list-header__count-total"
      >
        / {{ t('items.total', { total }) }}
      </span>
    </div>
    <v-spacer />
    <slot />
    <v-btn
      v-shared-tooltip="() => t('mod.denseView')"
      icon
      variant="text"
      density="comfortable"
      @click="dense = !dense"
    >
      <v-icon> {{ dense ? 'reorder' : 'list' }} </v-icon>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { vSharedTooltip } from '@/directives/sharedTooltip'

defineProps<{
  /**
   * Already-formatted label (typically includes the count, e.g. "12 Mods").
   */
  label: string
  /**
   * Optional total count to render as " / N total" — for remote search results.
   */
  total?: number
}>()

const dense = defineModel<boolean>('dense', { required: true })

const { t } = useI18n()
</script>

<style scoped>
.market-list-header__count {
  min-width: 0;
  max-width: 60%;
  display: inline-block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
}
.market-list-header__count-main {
  display: inline-block;
  vertical-align: middle;
}
.market-list-header__count-total {
  margin-left: 4px;
}
</style>
