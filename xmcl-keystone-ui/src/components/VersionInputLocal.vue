<script lang="ts" setup>
import { LocalVersionHeader } from '@xmcl/runtime-api'
import VersionInput, { VersionItem } from './VersionInput.vue'

const props = defineProps<{
  versions: LocalVersionHeader[]
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
    icon="http://launcher/icons/craftingTable"
    :title="t('localVersion.title', 1)"
    :url="t('localVersion.hint')"
    :is-clearable="true"
    :items="localItems"
    :empty-text="t('localVersion.empty')"
    :placeholder="t('localVersion.auto')"
    :value="value"
    @input="emit('input', $event)"
  />
</template>
