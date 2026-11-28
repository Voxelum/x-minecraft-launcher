<template>
  <div class="flex flex-col gap-2 py-2">
    <form class="flex flex-wrap items-center gap-2" @submit.prevent="search">
      <v-text-field v-model="query" class="min-w-36 flex-1" :label="t('userSkin.mosaicarySearch')" density="compact" variant="outlined" hide-details />
      <v-select v-model="arms" class="min-w-28 flex-[0_1_10rem]" :items="models" :label="t('userSkin.mosaicaryModel')" density="compact" variant="outlined" hide-details />
      <v-btn type="submit" color="primary" variant="tonal" :loading="loading">{{ t('shared.search') }}</v-btn>
    </form>
    <div class="flex flex-wrap items-center justify-between gap-x-3">
      <a class="text-xs text-primary hover:underline" href="https://mosaicary.com" target="_blank" rel="noopener noreferrer">{{ t('userSkin.mosaicarySource') }}</a>
      <div v-if="!failed && pages > 1" class="flex items-center gap-1 text-xs tabular-nums">
        <v-btn icon="chevron_left" :aria-label="t('userSkin.mosaicaryPrevious')" size="x-small" variant="text" :disabled="loading || page <= 1" @click="load(page - 1)" />
        <span aria-live="polite">{{ page }} / {{ pages }}</span>
        <v-btn icon="chevron_right" :aria-label="t('userSkin.mosaicaryNext')" size="x-small" variant="text" :disabled="loading || page >= pages" @click="load(page + 1)" />
      </div>
    </div>
    <div :aria-busy="loading">
      <v-alert v-if="failed" type="error" variant="tonal" density="compact">{{ t('userSkin.mosaicaryFailed') }}</v-alert>
      <p v-else-if="!loading && !skins.length" role="status" class="py-4 text-center text-sm opacity-70">{{ t('userSkin.noSkinsFound') }}</p>
      <ul v-if="skins.length" class="catalog-grid grid gap-2 p-1">
        <li v-for="skin in skins" :key="skin.id" class="catalog-card min-w-0 rounded-lg" :class="{ 'catalog-card--selected': selectedId === skin.id }">
          <button
            type="button"
            class="catalog-choice relative flex w-full flex-col items-center gap-0.5 rounded-lg px-2 pt-2 text-center"
            :aria-pressed="selectedId === skin.id"
            @click="emit('select', { id: skin.id, name: skin.name, url: skin.png, slim: skin.arms === 'slim' })"
          >
            <v-icon v-if="selectedId === skin.id" class="absolute end-2 top-2" color="primary" size="18" aria-hidden="true">check_circle</v-icon>
            <img :src="skin.front" alt="" loading="lazy" class="h-16 w-16 object-contain">
            <span class="max-w-full truncate text-sm font-semibold" :title="skin.name">{{ skin.name }}</span>
            <span class="text-xs opacity-70">{{ t(skin.arms === 'slim' ? 'userSkin.slim' : 'userSkin.classic') }}</span>
          </button>
          <a :href="skin.page" target="_blank" rel="noopener noreferrer" class="block truncate px-2 pb-2 pt-1 text-center text-xs text-primary hover:underline" :title="credit(skin)">{{ credit(skin) }}</a>
        </li>
      </ul>
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

<style scoped>
.catalog-grid {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 8.5rem), 1fr));
  margin: 0;
  list-style: none;
}

.catalog-card {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  transition: background-color 150ms ease, border-color 150ms ease;
}

.catalog-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.04);
}

.catalog-card.catalog-card--selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.catalog-card .catalog-choice {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.catalog-choice:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}
</style>
