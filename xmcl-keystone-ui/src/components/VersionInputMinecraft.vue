<script lang="ts" setup>
import { computed, markRaw, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import VersionInput, { VersionItem } from './VersionInput.vue'
import { useMinecraftVersions } from '@/composables/version'
import { BuiltinImages } from '../constant'

const props = defineProps<{
  value: string
  supportedVersions?: string[]
}>()

const { versions: vers, isValidating, release, mutate, error } = useMinecraftVersions()
const { t } = useI18n()
const showAlpha = ref(false)

const items = computed(() => {
  let list = vers.value
  if (props.supportedVersions && props.supportedVersions.length > 0) {
    const supportedSet = new Set(props.supportedVersions.map(s => s.toLowerCase()))
    const filtered = list.filter(v => supportedSet.has(v.id.toLowerCase()))
    if (filtered.length > 0) {
      return filtered.map(v => markRaw({
        tag: v.type === 'snapshot' ? t('minecraftVersion.snapshot') : v.type === 'release' ? t('minecraftVersion.release') : '',
        tagColor: v.type === 'release' ? 'primary' : '',
        name: v.id,
      } as VersionItem))
    }
    return props.supportedVersions.map(s => markRaw({
      tag: t('minecraftVersion.release'),
      tagColor: 'primary',
      name: s,
    } as VersionItem))
  } else {
    list = list.filter(v => showAlpha.value || v.type === 'release')
  }

  return list.map(v => markRaw({
    tag: v.type === 'snapshot' ? t('minecraftVersion.snapshot') : v.type === 'release' ? t('minecraftVersion.release') : '',
    tagColor: v.type === 'release' ? 'primary' : '',
    name: v.id,
  } as VersionItem))
})

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()

// When supportedVersions changes or loads, if current value is not supported, adapt to the latest supported Minecraft version
watch([() => props.supportedVersions, items], ([supported]) => {
  if (supported && supported.length > 0) {
    const hasCurrent = supported.some(s => s.toLowerCase() === props.value?.toLowerCase())
    if (!hasCurrent && items.value.length > 0) {
      emit('input', items.value[0].name)
    }
  }
}, { immediate: true })
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
    :has-snapshot="!supportedVersions || supportedVersions.length === 0"
    v-model:snapshot="showAlpha"
    :snapshot-tooltip="t('fabricVersion.showSnapshot')"
    :placeholder="''"
    :value="value"
    @refresh="mutate()"
    @input="emit('input', $event)"
  />
</template>
