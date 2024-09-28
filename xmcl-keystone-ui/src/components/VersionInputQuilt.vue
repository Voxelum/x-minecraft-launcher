<script lang="ts" setup>
import { useQuiltVersions } from '@/composables/version'
import VersionInput, { VersionItem } from './VersionInput.vue'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  minecraft: string
  value?: string
}>()

const { versions, isValidating, mutate, error } = useQuiltVersions(computed(() => props.minecraft))
const items = computed(() => {
  const result: VersionItem[] = (versions.value ?? [])
    .map((v) => {
      return markRaw({
        name: v.version,
        description: v.maven,
        tag: v.stable ? t('fabricVersion.stable') : t('fabricVersion.unstable'),
        tagColor: v.stable ? 'primary' : undefined,
      })
    })
  return result
})

const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
<template>
  <VersionInput
    :icon="BuiltinImages.quilt"
    title="Quilt"
    url="https://quiltmc.org/"
    :is-clearable="true"
    :items="items"
    :error="error"
    :clear-text="t('quiltVersion.disable')"
    :empty-text="t('quiltVersion.empty', { version: minecraft })"
    :refreshing="isValidating"
    :placeholder="t('quiltVersion.disable')"
    :value="value"
    @refresh="mutate()"
    @input="emit('input', $event)"
  />
</template>
