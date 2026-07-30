<template>
  <div
    v-if="entries.length > 0"
    class="env-var-table"
  >
    <div
      v-for="[key, value] in entries"
      :key="key"
      class="env-var-row"
      :class="{ 'env-var-row--readonly': readonly?.includes(key) }"
    >
      <v-icon
        class="env-var-row__icon"
        size="small"
      >
        key
      </v-icon>
      <span
        v-shared-tooltip="key"
        class="env-var-row__key"
      >
        {{ key }}
      </span>

      <span class="env-var-row__sep">=</span>

      <span
        v-shared-tooltip="value"
        class="env-var-row__value"
      >
        {{ value || emptyValuePlaceholder }}
      </span>

      <BaseSettingGlobalLabel
        v-if="readonly?.includes(key)"
        :global="true"
        class="env-var-row__badge"
      />

      <v-btn
        v-if="!readonly?.includes(key)"
        v-shared-tooltip="() => t('shared.remove')"
        class="env-var-row__delete"
        icon
        variant="text"
        density="comfortable"
        size="small"
        @click="emit('delete', key)"
      >
        <v-icon
          color="error"
          size="small"
        >
          delete
        </v-icon>
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { vSharedTooltip } from '@/directives/sharedTooltip'
import BaseSettingGlobalLabel from '@/components/BaseSettingGlobalLabel.vue'

const props = defineProps<{
  env: Record<string, string>
  readonly?: string[]
}>()
const emit = defineEmits<{
  (event: 'delete', key: string): void
}>()
const { t } = useI18n()

const entries = computed(() =>
  Object.entries(props.env).sort(([a], [b]) => a.localeCompare(b)),
)

const emptyValuePlaceholder = '∅'
</script>

<style scoped>
.env-var-table {
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  background-color: rgba(var(--v-theme-on-surface), 0.02);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.env-var-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 2fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  min-height: 40px;
  transition: background-color 0.15s ease;
}

.env-var-row + .env-var-row {
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.06);
}

.env-var-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.env-var-row__icon {
  opacity: 0.6;
}

.env-var-row__key {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.env-var-row__sep {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.875rem;
  opacity: 0.5;
  user-select: none;
}

.env-var-row__value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: rgba(var(--v-theme-on-surface), 0.05);
  opacity: 0.85;
}

.env-var-row__badge {
  margin-left: 4px;
}

/* Delete button only fully visible on row hover for a calmer look */
.env-var-row__delete {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.env-var-row:hover .env-var-row__delete,
.env-var-row__delete:focus-visible {
  opacity: 1;
}

.env-var-row--readonly .env-var-row__value {
  opacity: 0.6;
}
</style>

