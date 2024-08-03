<script lang="ts" setup>
import { useForgeVersions } from '@/composables/version'
import { ForgeVersion } from '@xmcl/runtime-api'
import VersionInput, { VersionItem } from './VersionInput.vue'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  minecraft: string
  value?: string
}>()

const { versions, isValidating, mutate, error } = useForgeVersions(computed(() => props.minecraft))
const { t } = useI18n()

const recommendedOnly = ref(false)
const canShowBuggy = ref(false)

function filterForge(version: ForgeVersion) {
  if (recommendedOnly.value && version.type !== 'recommended' && version.type !== 'latest') { return false }
  if (canShowBuggy.value && version.type !== 'buggy') { return true }
  return true
}
const items = computed(() => {
  const result: VersionItem[] = (versions.value ?? [])
    .filter(filterForge).sort((a, b) => {
      if (a.date && b.date) {
        // @ts-ignore
        return new Date(b.date) - (new Date(a.date))
      }
      return b.version.localeCompare(a.version)
    })
    .map(v => {
      return markRaw({
        name: v.version,
        tag: v.type === 'recommended' ? t('forgeVersion.recommended') : v.type === 'latest' ? t('forgeVersion.latest') : '',
        tagColor: v.type === 'recommended' ? 'primary' : '',
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
    :icon="BuiltinImages.forge"
    title="Forge"
    url="https://github.com/MinecraftForge/MinecraftForge"
    :is-clearable="true"
    :items="items"
    :has-snapshot="true"
    :error="error"
    :clear-text="t('forgeVersion.disable')"
    :empty-text="t('forgeVersion.empty', { version: minecraft })"
    :snapshot.sync="canShowBuggy"
    :snapshot-tooltip="t('fabricVersion.showSnapshot')"
    :refreshing="isValidating"
    :placeholder="t('forgeVersion.disable')"
    :value="value"
    @input="emit('input', $event)"
    @refresh="mutate()"
  />
</template>
