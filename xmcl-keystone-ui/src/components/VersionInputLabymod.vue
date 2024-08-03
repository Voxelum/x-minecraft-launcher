<script lang="ts" setup>
import VersionInput, { VersionItem } from './VersionInput.vue'
import { useLabyModManifest } from '@/composables/version'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  minecraft: string
  value?: string
}>()

const { data, isValidating, mutate, error } = useLabyModManifest()

const items = computed(() => {
  const manifest = data.value
  if (!manifest) { return [] }
  const mcVersion = manifest.minecraftVersions.find(v => v.tag === props.minecraft)
  if (!mcVersion) { return [] }
  const result: VersionItem[] = [markRaw({
    name: manifest.labyModVersion,
    status: 'remote',
  })]
  return result
})
const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
<template>
  <VersionInput
    :icon="BuiltinImages.labyMod"
    title="LabyMod"
    url="https://www.labymod.net"
    :is-clearable="true"
    :items="items"
    :error="error"
    :clear-text="t('labyMod.disable')"
    :empty-text="t('labyMod.empty', { version: minecraft })"
    :refreshing="isValidating"
    :placeholder="t('labyMod.disable')"
    :value="value"
    @refresh="mutate()"
    @input="emit('input', $event)"
  />
</template>
