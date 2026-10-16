<script lang="ts" setup>
import { computed, markRaw, onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import VersionInput, { VersionItem } from './VersionInput.vue'
import { useOptifineVersions } from '@/composables/version'
import { BuiltinImages } from '../constant'
import { KNOWN_OPTIFINE_BUILDS } from '@/util/optifine'
import type { OptifineVersion } from '@xmcl/runtime-api'

const props = defineProps<{
  minecraft: string
  forge: string
  value?: string
  autoSelectLatest?: boolean
}>()

const { versions, error, isValidating, mutate } = useOptifineVersions()

const fallbackVersions = shallowRef<OptifineVersion[]>(KNOWN_OPTIFINE_BUILDS)

async function fetchFallback() {
  try {
    const res = await fetch('https://bmclapi2.bangbang93.com/optifine/versionList')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        fallbackVersions.value = data
        return
      }
    }
  } catch {
    // ignore
  }
  try {
    const res = await fetch('https://optifine.net/downloads')
    if (res.ok) {
      const html = await res.text()
      const parsed: OptifineVersion[] = []
      const regex = /f=(?:preview_)?OptiFine_([0-9a-zA-Z._]+)_(HD_U[A-Z0-9]*)_([^.]+)\.jar/g
      let match: RegExpExecArray | null
      const seen = new Set<string>()

      while ((match = regex.exec(html)) !== null) {
        const [, mcversion, type, patch] = match
        const key = `${mcversion}_${type}_${patch}`
        if (!seen.has(key)) {
          seen.add(key)
          parsed.push({ mcversion, type, patch })
        }
      }
      if (parsed.length > 0) {
        fallbackVersions.value = parsed
      }
    }
  } catch {
    // ignore
  }
}

onMounted(() => {
  fetchFallback()
})

const effectiveVersions = computed(() => {
  const map = new Map<string, OptifineVersion>()
  for (const v of fallbackVersions.value) {
    map.set(`${v.mcversion}_${v.type}_${v.patch}`, v)
  }
  for (const v of versions.value) {
    map.set(`${v.mcversion}_${v.type}_${v.patch}`, v)
  }
  return Array.from(map.values())
})

const items = computed(() => {
  const filtered = effectiveVersions.value.filter(v => (v.mcversion.endsWith('.0') ? v.mcversion.slice(0, v.mcversion.length - 2) : v.mcversion) === props.minecraft) ?? []
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
const latestVersion = computed(() => items.value[0]?.name ?? '')

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
    :error="items.length > 0 ? undefined : error"
    :clear-text="t('optifineVersion.disable')"
    :empty-text="t('optifineVersion.empty', { version: minecraft })"
    :refreshing="isValidating"
    :placeholder="t('optifineVersion.disable')"
    :auto-select="autoSelectLatest ? latestVersion : undefined"
    :value="value"
    @refresh="mutate()"
    @input="emit('input', $event)"
  />
</template>
