<template>
  <v-list-item
    v-if="Object.keys(env).length > 0"
    class="fix-after gap-x-4 grid grid-cols-2"
    dense
  >
    <!-- <div> -->
    <div
      v-for="(value, key) in items"
      :key="key"
      class="flex items-center v-list-item__subtitle"
    >
      <v-icon left>
        key
      </v-icon>
      <span
        v-shared-tooltip="key"
        class="overflow-hidden text-ellipsis"
      >
        {{ key }}
      </span>
      <BaseSettingGlobalLabel
        v-if="readonly?.includes(key)"
        :global="true"
      />
      <v-spacer class="mr-4" />
      <span
        v-shared-tooltip="value"
        class="overflow-hidden text-ellipsis"
      >
        {{ value }}
      </span>
      <v-btn
        v-if="!readonly?.includes(key)"
        icon
        color="error"
        @click="emit('delete', key)"
      >
        <v-icon class="material-icons-outlined">
          delete
        </v-icon>
      </v-btn>
    </div>
    <!-- </div> -->
  </v-list-item>
</template>

<script setup lang="ts">
import { vSharedTooltip } from '@/directives/sharedTooltip'
import BaseSettingGlobalLabel from '@/views/BaseSettingGlobalLabel.vue'

const props = defineProps<{
  env: Record<string, string>
  readonly?: string[]
}>()
const emit = defineEmits(['delete'])

const items = computed(() => Object.fromEntries(Object.entries(props.env).sort(([a], [b]) => a.localeCompare(b))) as Record<string, string>)
</script>
<style lang="css" scoped>
.fix-after::after {
  display: none;
}
</style>
