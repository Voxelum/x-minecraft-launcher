<script lang="ts" setup>
import VersionInput, { VersionItem } from './VersionInput.vue'
import { useOptifineVersions } from '@/composables/version'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  minecraft: string
  forge: string
  value?: string
}>()

const { versions, error, isValidating, mutate } = useOptifineVersions()

const items = computed(() => {
  const filtered = versions.value.filter(v => v.mcversion === props.minecraft) ?? []
  return filtered.sort((a, b) => {
    const { patch, type } = a
    // compare type first and then the patch
    const result = type.localeCompare(b.type)
    if (result === 0) {
      return -patch.localeCompare(b.patch)
    }
    return -result
  }).map((v) => {
    const name = v.type + '_' + v.patch
    const result: VersionItem = markRaw({
      name,
      description: v.patch,
    })
    return result
  })
})

const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>

<template>
  <VersionInput
    :icon="BuiltinImages.optifine"
    title="Optifine"
    url="https://www.optifine.net/home"
    :is-clearable="true"
    :items="items"
    :error="error"
    :clear-text="t('optifineVersion.disable')"
    :empty-text="t('optifineVersion.empty', { version: minecraft })"
    :refreshing="isValidating"
    :placeholder="t('optifineVersion.disable')"
    :value="value"
    @refresh="mutate()"
    @input="emit('input', $event)"
  />
</template>
