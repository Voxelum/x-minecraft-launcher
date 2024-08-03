<script lang="ts" setup>
import { useNeoForgedVersions } from '@/composables/version'
import VersionInput, { VersionItem } from './VersionInput.vue'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  minecraft: string
  value?: string
}>()
const { versions, latest, recommended, isValidating, mutate, error } = useNeoForgedVersions(computed(() => props.minecraft))
const { t } = useI18n()

const items = computed(() => {
  const vers = versions.value
  const result: VersionItem[] = vers
    .map(v => {
      return markRaw({
        name: v,
        description: '',
        tag: recommended.value === v
          ? t('forgeVersion.recommended')
          : latest.value === v ? t('forgeVersion.latest') : '',
        tagColor: recommended.value === v ? 'primary' : '',
      })
    })
  return result
})

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
<template>
  <VersionInput
    :icon="BuiltinImages.neoForged"
    title="NeoForge"
    url="https://github.com/neoforged/NeoForge"
    :is-clearable="true"
    :items="items"
    :error="error"
    :clear-text="t('neoForgedVersion.disable')"
    :empty-text="t('neoForgedVersion.empty', { version: minecraft })"
    :refreshing="isValidating"
    :placeholder="t('neoForgedVersion.disable')"
    :value="value"
    @refresh="mutate()"
    @input="emit('input', $event)"
  />
</template>
