<script lang="ts" setup>
import { VersionHeader } from '@xmcl/runtime-api'
import VersionInput, { VersionItem } from './VersionInput.vue'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  versions: VersionHeader[]
  value?: string
}>()

const localItems = computed(() => props.versions.map(ver => {
  const result: VersionItem = {
    name: ver.id,
    tag: ver.minecraft,
  }
  return result
}))

const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>

<template>
  <VersionInput
    :icon="BuiltinImages.craftingTable"
    :title="t('localVersion.title', 1)"
    :url="t('localVersion.hint')"
    :is-clearable="true"
    :items="localItems"
    :clear-text="t('localVersion.auto')"
    :empty-text="t('localVersion.empty')"
    :placeholder="t('localVersion.auto')"
    :value="value"
    @input="emit('input', $event)"
  />
</template>
