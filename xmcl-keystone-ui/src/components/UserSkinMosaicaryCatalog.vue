<template>
  <div class="flex flex-col gap-3">
    <a class="text-primary underline self-start" href="https://mosaicary.com" target="_blank" rel="noopener noreferrer">{{ t('userSkin.mosaicarySource') }}</a>
    <form class="flex flex-wrap items-center gap-2" @submit.prevent="search">
      <v-text-field v-model="query" class="min-w-36 flex-1" :label="t('userSkin.mosaicarySearch')" density="compact" variant="outlined" hide-details />
      <v-select v-model="arms" class="min-w-28" :items="models" :label="t('userSkin.mosaicaryModel')" density="compact" variant="outlined" hide-details />
      <v-btn type="submit" variant="tonal" :loading="loading">{{ t('shared.search') }}</v-btn>
    </form>
    <v-alert v-if="failed" type="error" variant="tonal" density="compact">{{ t('userSkin.mosaicaryFailed') }}</v-alert>
    <p v-else-if="!loading && !skins.length">{{ t('userSkin.noSkinsFound') }}</p>
    <div v-if="skins.length" class="grid grid-cols-2 gap-2 xl:grid-cols-3">
      <div v-for="skin in skins" :key="skin.id" class="min-w-0 rounded-lg border p-2 text-center">
        <button
          type="button"
          class="w-full rounded hover:bg-primary/10 focus-visible:outline"
          :class="{ 'bg-primary/15': selectedId === skin.id }"
          :aria-pressed="selectedId === skin.id"
          @click="emit('select', { id: skin.id, name: skin.name, url: skin.png, slim: skin.arms === 'slim' })"
        >
          <img :src="skin.front" alt="" loading="lazy" class="mx-auto h-20 w-20 object-contain">
          <div class="truncate" :title="skin.name">{{ skin.name }}</div>
          <div class="text-xs opacity-70">{{ t(skin.arms === 'slim' ? 'userSkin.slim' : 'userSkin.classic') }}</div>
        </button>
        <a :href="skin.page" target="_blank" rel="noopener noreferrer" class="block truncate text-xs text-primary underline" :title="credit(skin)">{{ credit(skin) }}</a>
      </div>
    </div>
    <div v-if="!failed && pages > 1" class="flex items-center justify-center gap-2">
      <v-btn icon="chevron_left" :aria-label="t('userSkin.mosaicaryPrevious')" size="small" variant="text" :disabled="loading || page <= 1" @click="load(page - 1)" />
      <span>{{ page }} / {{ pages }}</span>
      <v-btn icon="chevron_right" :aria-label="t('userSkin.mosaicaryNext')" size="small" variant="text" :disabled="loading || page >= pages" @click="load(page + 1)" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface CatalogSkin {
  id: string
  name: string
  arms: 'classic' | 'slim'
  png: string
  front: string
  page: string
  found: boolean
  author: { name: string } | null
}

defineProps<{ selectedId: string }>()
const emit = defineEmits<{
  (event: 'select', skin: { id: string; name: string; url: string; slim: boolean }): void
}>()

const { t } = useI18n()
const models = computed(() => [
  { title: t('userSkin.mosaicaryAllModels'), value: '' },
  { title: t('userSkin.classic'), value: 'classic' },
  { title: t('userSkin.slim'), value: 'slim' },
])
const query = ref('')
const arms = ref('')
const skins = ref<CatalogSkin[]>([])
const loading = ref(false)
const failed = ref(false)
const page = ref(1)
const pages = ref(0)
let filters = { q: '', arms: '' }
let request: AbortController | undefined

function credit(skin: CatalogSkin) {
  if (skin.found) return t('userSkin.mosaicaryFound')
  if (skin.author?.name) return t('userSkin.mosaicaryAuthor', { author: skin.author.name })
  return t('userSkin.mosaicarySource')
}

function isMosaicaryUrl(value: string) {
  return typeof value === 'string' && /^https:\/\/mosaicary\.com\//.test(value)
}

async function load(next: number) {
  request?.abort()
  const current = new AbortController()
  request = current
  const params = new URLSearchParams({ size: '64', per: '12', page: String(next) })
  if (filters.q) params.set('q', filters.q)
  if (filters.arms) params.set('arms', filters.arms)
  loading.value = true
  failed.value = false
  try {
    const response = await fetch(`https://mosaicary.com/api/skins?${params}`, { signal: current.signal, credentials: 'omit' })
    if (!response.ok) throw new Error(`Mosaicary HTTP ${response.status}`)
    const result: { skins: CatalogSkin[]; pages: number } = await response.json()
    if (current.signal.aborted) return
    skins.value = result.skins.filter(skin => /^[a-z\d]{12}$/i.test(skin.id) &&
      typeof skin.name === 'string' && (skin.arms === 'classic' || skin.arms === 'slim') &&
      isMosaicaryUrl(skin.png) && isMosaicaryUrl(skin.front) && isMosaicaryUrl(skin.page))
    pages.value = result.pages
    page.value = next
  } catch {
    if (!current.signal.aborted) {
      failed.value = true
      skins.value = []
      pages.value = 0
    }
  } finally {
    if (!current.signal.aborted) loading.value = false
  }
}

function search() {
  filters = { q: query.value.trim(), arms: arms.value }
  return load(1)
}

onMounted(search)
onBeforeUnmount(() => request?.abort())
</script>
