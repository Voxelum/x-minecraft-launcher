<template>
  <div
    class="flex items-center text-center"
    style="color: var(--color-secondary-text)"
  >
    <span class="mr-2 whitespace-nowrap font-bold">
      {{ t('shared.install') }}:
    </span>
    <v-menu offset-y>
      <template #activator="{ props }">
        <v-btn
          hide-details
          size="small"
          variant="text"
          border
          v-bind="props"
        >
          <v-icon start class="material-icons-outlined" size="small">folder</v-icon>
          <span class="xl:max-w-50 max-w-40 overflow-hidden overflow-ellipsis whitespace-nowrap 2xl:max-w-full">
            {{ selectedTitle || t('save.datapack.noSaveHint') }}
          </span>
          <v-icon class="material-icons-outlined" end>arrow_drop_down</v-icon>
        </v-btn>
      </template>
      <v-list class="max-h-[400px] w-60 overflow-auto">
        <v-list-item
          v-for="item in items"
          :key="item.value"
          :class="{ 'v-list-item--active': item.value === modelValue }"
          :title="item.title"
          @click="emit('update:modelValue', item.value)"
        >
          <template #prepend>
            <v-icon size="small">public</v-icon>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script lang="ts" setup>
const props = defineProps<{
  modelValue: string
  items: Array<{ title: string; value: string }>
}>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const { t } = useI18n()

const selectedTitle = computed(() => props.items.find((i) => i.value === props.modelValue)?.title ?? '')
</script>
