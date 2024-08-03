<script lang="ts" setup>
import VersionInput, { VersionItem } from './VersionInput.vue'
import { useFabricVersions } from '@/composables/version'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  minecraft: string
  value?: string
}>()
const { t } = useI18n()
const showStableOnly = ref(false)
const { versions, error, mutate, isValidating } = useFabricVersions(computed(() => props.minecraft))
const items = computed(() => {
  const result: VersionItem[] = versions.value
    .filter((v) => !showStableOnly.value || v.stable)
    .map((v) => {
      return markRaw({
        name: v.version,
        tag: v.stable ? t('fabricVersion.stable') : t('fabricVersion.unstable'),
        tagColor: v.stable ? 'primary' : undefined,
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
    :icon="BuiltinImages.fabric"
    title="Fabric"
    url="https://fabricmc.net/"
    :is-clearable="true"
    :items="items"
    :has-snapshot="true"
    :error="error"
    :clear-text="t('fabricVersion.disable')"
    :empty-text="t('fabricVersion.empty', { version: minecraft })"
    :snapshot.sync="showStableOnly"
    :snapshot-tooltip="t('fabricVersion.showSnapshot')"
    :refreshing="isValidating"
    :placeholder="t('fabricVersion.disable')"
    :value="value"
    @refresh="mutate()"
    @input="emit('input', $event)"
  />
</template>
