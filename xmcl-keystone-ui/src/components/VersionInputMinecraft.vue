<script lang="ts" setup>
import VersionInput, { VersionItem } from './VersionInput.vue'
import { useMinecraftVersions } from '@/composables/version'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  value: string
}>()
const { versions: vers, isValidating, release, mutate, error } = useMinecraftVersions()
const { t } = useI18n()
const showAlpha = ref(false)
const items = computed(() => {
  const result = vers.value
    .filter(v => showAlpha.value || v.type === 'release')
    .map(v => markRaw({
      tag: v.type === 'snapshot' ? t('minecraftVersion.snapshot') : v.type === 'release' ? t('minecraftVersion.release') : '',
      tagColor: v.type === 'release' ? 'primary' : '',
      name: v.id,
    } as VersionItem))
  return result
})

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
<template>
  <VersionInput
    :icon="BuiltinImages.minecraft"
    title="Minecraft"
    url="https://minecraft.net"
    :is-clearable="false"
    :items="items"
    :error="error"
    :refreshing="isValidating"
    :has-snapshot="true"
    :snapshot.sync="showAlpha"
    :snapshot-tooltip="t('fabricVersion.showSnapshot')"
    :placeholder="''"
    :value="value"
    @refresh="mutate()"
    @input="emit('input', $event)"
  />
</template>
