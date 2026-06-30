<template>
  <MarketBase
    class="blueprint-page"
    data-testid="blueprint-page"
    :items="(items as any)"
    :item-height="72"
    :plans="{}"
    :loading="isRemote ? marketLoading : isValidating"
    :error="errorText"
    @load="loadMoreMarket"
  >
    <template #filter>
      <v-card
        rounded="0"
        flat
        color="transparent"
        class="flex flex-col w-full h-full"
        @mousedown.prevent
      >
        <v-tabs
          :model-value="isRemote ? 0 : 1"
          color="primary"
          slider-color="primary"
          align-tabs="center"
          fixed-tabs
          style="min-height: 48px;"
          @update:model-value="source = $event === 0 ? 'market' : ''"
        >
          <v-tab :value="0" prepend-icon="storefront" data-testid="blueprint-market-tab">
            {{ t('search.market') }}
          </v-tab>
          <v-tab :value="1" prepend-icon="inventory_2" data-testid="blueprint-local-tab">
            {{ t('search.local') }}
          </v-tab>
        </v-tabs>

        <div v-if="isRemote" class="flex flex-col gap-3 px-3 pt-3">
          <div class="filter-subheader flex items-center">
            <v-icon size="16" class="mr-1">
              source
            </v-icon>
            {{ t('blueprint.provider') }}
          </div>
          <div class="flex flex-wrap gap-1">
            <v-chip size="small" label>
              MCS
            </v-chip>
            <v-chip size="small" label>
              CMS
            </v-chip>
            <v-chip size="small" label>
              MS.com
            </v-chip>
          </div>
          <v-alert
            type="info"
            density="compact"
          >
            {{ t('blueprint.mixedSources') }}
          </v-alert>
        </div>
        <div v-else class="flex flex-1 flex-col items-center justify-center opacity-50">
          <v-icon size="64">
            view_in_ar
          </v-icon>
          <span class="mt-2">{{ t('blueprint.selectHint') }}</span>
        </div>
      </v-card>
    </template>

    <template #placeholder>
      <div class="flex h-full flex-col items-center justify-center opacity-60">
        <v-icon size="72">
          view_in_ar
        </v-icon>
        <span class="mt-3 text-lg">{{ isRemote ? t('blueprint.searchOnline') : t('blueprint.empty') }}</span>
      </div>
    </template>

    <template #item="{ item: rawItem, selected, on }">
      <v-list-item
        v-if="isMarketEntry(rawItem)"
        :key="asMarket(rawItem).provider + asMarket(rawItem).id"
        class="rounded mx-1 mb-1 bg-[rgba(255,255,255,0.05)]"
        :active="selected"
        data-testid="blueprint-market-item"
        v-on="on"
      >
        <template #prepend>
          <v-avatar rounded size="56" class="mr-3">
            <v-img v-if="asMarket(rawItem).icon" :src="asMarket(rawItem).icon" />
            <v-icon v-else>
              view_in_ar
            </v-icon>
          </v-avatar>
        </template>
        <v-list-item-title>{{ asMarket(rawItem).title }}</v-list-item-title>
        <v-list-item-subtitle class="flex items-center gap-2 mt-1">
          <v-chip size="x-small" label color="primary">
            {{ providerLabel(asMarket(rawItem).provider) }}
          </v-chip>
          <v-chip v-if="asMarket(rawItem).fileType" size="x-small" label>
            {{ asMarket(rawItem).fileType }}
          </v-chip>
          <span v-if="asMarket(rawItem).author">{{ asMarket(rawItem).author }}</span>
          <span v-if="asMarket(rawItem).downloadCount !== undefined">· ↓ {{ asMarket(rawItem).downloadCount }}</span>
        </v-list-item-subtitle>
        <template #append>
          <v-btn
            v-if="asMarket(rawItem).installable"
            size="small"
            variant="tonal"
            color="primary"
            icon="file_download"
            :title="t('blueprint.install')"
            :loading="installing === asMarket(rawItem).id"
            @click.stop="installFromMarket(asMarket(rawItem))"
          />
        </template>
      </v-list-item>
      <v-list-item
        v-else
        :key="asBp(rawItem).path"
        class="rounded mx-1 mb-1 bg-[rgba(255,255,255,0.04)]"
        :active="selected"
        data-testid="blueprint-item"
        v-on="on"
      >
        <template #prepend>
          <v-icon class="mr-3">
            view_in_ar
          </v-icon>
        </template>
        <v-list-item-title>{{ asBp(rawItem).fileName }}</v-list-item-title>
        <v-list-item-subtitle class="flex items-center gap-2 mt-1">
          <v-chip size="x-small" label>
            {{ formatLabel(asBp(rawItem).format) }}
          </v-chip>
          <span v-if="asBp(rawItem).dimensions">{{ asBp(rawItem).dimensions!.x }}×{{ asBp(rawItem).dimensions!.y }}×{{ asBp(rawItem).dimensions!.z }}</span>
          <span v-if="asBp(rawItem).blockCount !== undefined">· {{ t('blueprint.blocks', { count: asBp(rawItem).blockCount }) }}</span>
        </v-list-item-subtitle>
      </v-list-item>
    </template>

    <template #content>
      <div v-if="active" class="flex flex-col h-full overflow-hidden">
        <div class="flex items-center gap-1 px-3 pt-3">
          <span class="text-h6 truncate flex-grow">{{ active.fileName }}</span>
          <v-btn size="small" variant="text" prepend-icon="sync_alt" @click="openConvert(active)">
            {{ t('blueprint.convert.title') }}
          </v-btn>
          <v-btn size="small" variant="text" prepend-icon="find_replace" @click="openReplace(active)">
            {{ t('blueprint.replace.title') }}
          </v-btn>
          <v-btn size="small" variant="text" color="error" icon="delete" :title="t('blueprint.delete')" @click="remove(active)" />
        </div>
        <div class="rounded overflow-hidden mx-3 my-2" style="height: 55%; min-height: 240px">
          <BlueprintPreview
            :key="active.path"
            :instance-path="path"
            :file-name="active.fileName"
            :size="active.dimensions"
            :palette="active.palette"
            :voxels="active.voxels"
          />
        </div>
        <div class="flex-grow overflow-auto px-3">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-subtitle-2">{{ t('blueprint.materials') }}</span>
            <div class="flex-grow" />
            <v-select
              v-model="materialNamespace"
              :items="namespaceOptions"
              density="compact"
              variant="plain"
              hide-details
              class="blueprint-ns-filter text-sm"
            />
          </div>
          <v-list density="compact" class="bg-transparent">
            <v-list-item v-for="m in filteredMaterials" :key="m.block" class="px-0 min-h-0">
              <template #prepend>
                <img
                  :src="blockIconUrl(m.block)"
                  class="blueprint-mat-icon mr-2"
                  loading="lazy"
                  @error="onIconError"
                >
              </template>
              <v-list-item-title class="text-sm">
                {{ blockNames[m.block] || prettyBlock(m.block) }}
              </v-list-item-title>
              <template #append>
                <span class="text-sm opacity-70">×{{ m.count }}</span>
              </template>
            </v-list-item>
          </v-list>
        </div>
      </div>
      <div v-else-if="activeMarket" class="flex flex-col h-full overflow-hidden">
        <div
          class="relative flex items-end p-4"
          style="min-height: 180px"
        >
          <v-img
            v-if="activeMarket.icon"
            :src="activeMarket.icon"
            cover
            class="absolute inset-0"
            gradient="to top, rgba(0,0,0,.85), rgba(0,0,0,.25)"
          />
          <div v-else class="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,0.04)]">
            <v-icon size="96" class="opacity-30">
              view_in_ar
            </v-icon>
          </div>
          <div class="relative z-1">
            <div class="text-h5 font-weight-medium" :class="{ 'text-white': activeMarket.icon }">
              {{ activeMarket.title }}
            </div>
            <div v-if="activeMarket.author" class="flex items-center gap-2 mt-1">
              <v-avatar v-if="activeMarket.authorAvatar" size="20">
                <v-img :src="activeMarket.authorAvatar" />
              </v-avatar>
              <span class="text-subtitle-2 opacity-90" :class="{ 'text-white': activeMarket.icon }">
                {{ t('blueprint.byAuthor', { author: activeMarket.author }) }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 px-4 pt-3">
          <v-chip v-if="activeMarket.fileType" size="small" label prepend-icon="description">
            {{ activeMarket.fileType }}
          </v-chip>
          <v-chip v-if="activeMarket.size" size="small" label prepend-icon="straighten">
            {{ activeMarket.size }}
          </v-chip>
          <v-chip v-if="activeMarket.downloadCount !== undefined" size="small" label prepend-icon="download">
            {{ activeMarket.downloadCount }}
          </v-chip>
          <v-chip v-if="activeMarket.uploadTime" size="small" label prepend-icon="schedule">
            {{ formatDate(activeMarket.uploadTime) }}
          </v-chip>
          <v-chip size="small" label prepend-icon="storefront">
            {{ providerLabel(activeMarket.provider) }}
          </v-chip>
        </div>

        <div v-if="activeMarket.tags?.length" class="flex flex-wrap items-center gap-1 px-4 pt-2">
          <v-chip
            v-for="tag in activeMarket.tags"
            :key="tag"
            size="x-small"
            variant="outlined"
          >
            {{ tag }}
          </v-chip>
        </div>

        <div class="flex items-center gap-2 px-4 pt-3">
          <v-btn
            v-if="activeMarket.installable"
            color="primary"
            variant="flat"
            prepend-icon="file_download"
            :loading="installing === activeMarket.id"
            @click="installFromMarket(activeMarket)"
          >
            {{ t('blueprint.install') }}
          </v-btn>
          <v-btn
            v-if="activeMarket.pageUrl"
            variant="tonal"
            prepend-icon="open_in_new"
            @click="openLink(activeMarket.pageUrl!)"
          >
            {{ t('blueprint.goTo') }}
          </v-btn>
        </div>

        <div class="flex-grow overflow-auto px-4 py-3">
          <p v-if="activeMarket.description" class="text-body-2 whitespace-pre-line opacity-80">
            {{ activeMarket.description }}
          </p>
          <div v-else class="opacity-50 text-body-2">
            {{ t('blueprint.noDescription') }}
          </div>
        </div>
      </div>
      <div v-else class="flex flex-col items-center justify-center h-full opacity-50">
        <v-icon size="64">
          view_in_ar
        </v-icon>
        <span class="mt-2">{{ isRemote ? t('blueprint.searchOnline') : t('blueprint.selectHint') }}</span>
      </div>
    </template>

    <!-- Convert dialog -->
    <v-dialog v-model="convertDialog" width="460">
      <v-card v-if="active">
        <v-card-title>{{ t('blueprint.convert.title') }}</v-card-title>
        <v-card-text>
          <p class="mb-3 opacity-70">
            {{ t('blueprint.convert.hint') }}
          </p>
          <v-select
            v-model="convertTarget"
            :items="formatOptions"
            :label="t('blueprint.convert.target')"
            item-title="text"
            item-value="value"
            variant="outlined"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <div class="flex-grow" />
          <v-btn variant="text" @click="convertDialog = false">
            {{ t('blueprint.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="busy"
            @click="doConvert"
          >
            {{ t('blueprint.convert.action') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Replace dialog -->
    <v-dialog v-model="replaceDialog" width="640">
      <v-card v-if="active">
        <v-card-title>{{ t('blueprint.replace.title') }}</v-card-title>
        <v-card-text>
          <v-btn-toggle
            v-model="replaceMode"
            mandatory
            density="compact"
            class="mb-3"
          >
            <v-btn value="simple">
              {{ t('blueprint.replace.simple') }}
            </v-btn>
            <v-btn value="precise">
              {{ t('blueprint.replace.precise') }}
            </v-btn>
          </v-btn-toggle>
          <p class="text-sm opacity-70 mb-2">
            {{ replaceMode === 'simple' ? t('blueprint.replace.simpleHint') : t('blueprint.replace.preciseHint') }}
          </p>
          <div
            v-for="(rule, i) in replaceRules"
            :key="i"
            class="flex items-center gap-2 mb-2"
          >
            <v-text-field
              v-model="rule.from"
              :label="t('blueprint.replace.from')"
              placeholder="minecraft:stone"
              hide-details
              density="compact"
              variant="outlined"
            />
            <v-icon>arrow_forward</v-icon>
            <v-text-field
              v-model="rule.to"
              :label="t('blueprint.replace.to')"
              placeholder="minecraft:cobblestone"
              hide-details
              density="compact"
              variant="outlined"
            />
            <v-btn icon variant="text" size="small" @click="replaceRules.splice(i, 1)">
              <v-icon>close</v-icon>
            </v-btn>
          </div>
          <v-btn variant="text" prepend-icon="add" @click="replaceRules.push({ from: '', to: '' })">
            {{ t('blueprint.replace.addRule') }}
          </v-btn>
          <v-checkbox
            v-model="replaceNewFile"
            :label="t('blueprint.replace.newFile')"
            hide-details
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <div class="flex-grow" />
          <v-btn variant="text" @click="replaceDialog = false">
            {{ t('blueprint.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="busy"
            @click="doReplace"
          >
            {{ t('blueprint.replace.action') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </MarketBase>
</template>

<script lang="ts" setup>
import MarketBase from '@/components/MarketBase.vue'
import BlueprintPreview from './BlueprintPreview.vue'
import { kInstance } from '@/composables/instance'
import { useInstanceBlueprints, InstanceBlueprintFile } from '@/composables/instanceBlueprints'
import { useQuery } from '@/composables/query'
import { useService } from '@/composables/service'
import { injection } from '@/util/inject'
import {
  BlueprintMarketItem,
  BlueprintMarketProvider,
  BlueprintMarketServiceKey,
  InstanceBlueprintsServiceKey,
} from '@xmcl/runtime-api'

const { t, locale } = useI18n()
const { path } = injection(kInstance)
const { blueprints, isValidating, revalidate } = useInstanceBlueprints(path)
const { uninstall, convertBlueprint, replaceBlueprintBlocks, getBlueprintInfo, getBlockNames } = useService(InstanceBlueprintsServiceKey)
const { search: marketSearch, install: marketInstallSvc } = useService(BlueprintMarketServiceKey)

const keyword = useQuery('keyword')
const source = useQuery('source')
const isRemote = computed(() => source.value === 'market')
const errorText = ref('')
const busy = ref(false)

// MarketBase tracks selection via the `id` query param, matching items by `id`.
type BlueprintEntry = InstanceBlueprintFile & { id: string }
type MarketEntry = { id: string; market: BlueprintMarketItem }
const localItems = computed<BlueprintEntry[]>(() => {
  const k = keyword.value.toLowerCase().trim()
  const list = k ? blueprints.value.filter((b) => b.fileName.toLowerCase().includes(k)) : blueprints.value
  return list.map((b) => ({ ...b, id: b.path }))
})
const items = computed<(BlueprintEntry | MarketEntry)[]>(() =>
  isRemote.value ? marketItems.value.map((m) => ({ id: m.provider + m.id, market: m })) : localItems.value)

const selectedId = useQuery('id')
const active = computed(() => localItems.value.find((b) => b.id === selectedId.value))
const activeMarket = computed(() => marketItems.value.find((m) => m.provider + m.id === selectedId.value))
const asBp = (i: unknown) => i as BlueprintEntry
const asMarket = (i: unknown) => (i as MarketEntry).market
const isMarketEntry = (i: unknown) => typeof i === 'object' && i !== null && 'market' in i

const refreshFlag = useQuery('refresh')
watch(refreshFlag, () => revalidate())

function formatDate(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString()
}

function providerLabel(provider: BlueprintMarketProvider) {
  switch (provider) {
    case 'cms': return 'CMS'
    case 'minecraft-schematics': return 'MS.com'
    default: return 'MCS'
  }
}

function formatLabel(format?: string) {
  switch (format) {
    case 'litematic': return 'Litematica'
    case 'schem': return 'WorldEdit'
    case 'schematic': return 'WorldEdit (legacy)'
    case 'structure': return t('blueprint.formats.structure')
    case 'buildinggadget': return 'Building Gadgets'
    default: return format ?? '?'
  }
}

const formatOptions = computed(() => [
  { text: 'Litematica (.litematic)', value: 'litematic' },
  { text: 'WorldEdit (.schem)', value: 'schem' },
  { text: `${t('blueprint.formats.structure')} (.nbt)`, value: 'structure' },
  { text: 'Building Gadgets (.json)', value: 'buildinggadget' },
])

// Selected blueprint detail (right pane). Prefer the cached material list; fall
// back to a live parse for entries scanned before materials were cached.
const materials = ref<{ block: string; count: number }[]>([])
watch(active, async (bp) => {
  materials.value = bp?.materials ?? []
  if (!bp || (bp.materials && bp.materials.length > 0)) return
  try {
    const info = await getBlueprintInfo(path.value, bp.fileName)
    if (active.value?.path === bp.path) materials.value = info.materials
  } catch {
    // ignore; keep empty
  }
}, { immediate: true })

// Localized block display names (lazily fetched from the jars' lang files).
const blockNames = ref<Record<string, string>>({})
watch([materials, locale], async ([list]) => {
  blockNames.value = {}
  if (!list || list.length === 0) return
  try {
    blockNames.value = await getBlockNames((list as { block: string; count: number }[]).map((m) => m.block), String(locale.value))
  } catch {
    // ignore; fall back to prettified ids
  }
}, { immediate: true })

// Namespace filter for the material list.
const materialNamespace = ref('all')
const namespaceOf = (block: string) => (block.includes(':') ? block.slice(0, block.indexOf(':')) : 'minecraft')
const namespaceOptions = computed(() => {
  const namespaces = [...new Set(materials.value.map((m) => namespaceOf(m.block)))].sort()
  return [
    { title: t('blueprint.allNamespaces'), value: 'all' },
    ...namespaces.map((ns) => ({ title: ns, value: ns })),
  ]
})
watch(materials, () => { materialNamespace.value = 'all' })
const filteredMaterials = computed(() => {
  if (materialNamespace.value === 'all') return materials.value
  return materials.value.filter((m) => namespaceOf(m.block) === materialNamespace.value)
})

function blockIconUrl(block: string) {
  return `http://launcher/block-texture?block=${encodeURIComponent(block)}`
}
function onIconError(e: Event) {
  (e.target as HTMLImageElement).style.visibility = 'hidden'
}
function prettyBlock(block: string) {
  const name = block.includes(':') ? block.slice(block.indexOf(':') + 1) : block
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Convert
const convertDialog = ref(false)
const convertTarget = ref('litematic')
function openConvert(bp: InstanceBlueprintFile) {
  convertTarget.value = bp.format === 'litematic' ? 'schem' : 'litematic'
  convertDialog.value = true
}
async function doConvert() {
  if (!active.value) return
  busy.value = true
  try {
    await convertBlueprint({ instancePath: path.value, fileName: active.value.fileName, target: convertTarget.value as any })
    convertDialog.value = false
    revalidate()
  } catch (e) {
    errorText.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

// Replace
const replaceDialog = ref(false)
const replaceMode = ref<'simple' | 'precise'>('simple')
const replaceRules = ref<{ from: string; to: string }[]>([{ from: '', to: '' }])
const replaceNewFile = ref(false)
function openReplace(_bp: InstanceBlueprintFile) {
  replaceMode.value = 'simple'
  replaceRules.value = [{ from: '', to: '' }]
  replaceNewFile.value = false
  replaceDialog.value = true
}
async function doReplace() {
  if (!active.value) return
  const rules = replaceRules.value
    .filter((r) => r.from.trim() && r.to.trim())
    .map((r) => ({ from: r.from, to: r.to }))
  if (rules.length === 0) { replaceDialog.value = false; return }
  busy.value = true
  try {
    const output = replaceNewFile.value ? `${active.value.fileName.replace(/\.[^.]+$/, '')}-replaced${active.value.fileName.match(/\.[^.]+$/)?.[0] ?? ''}` : undefined
    await replaceBlueprintBlocks({ instancePath: path.value, fileName: active.value.fileName, replacements: rules, mode: replaceMode.value, output })
    replaceDialog.value = false
    revalidate()
  } catch (e) {
    errorText.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

// Import / delete
async function remove(bp: InstanceBlueprintFile) {
  try {
    await uninstall({ files: [bp.path], path: path.value })
    revalidate()
  } catch (e) {
    errorText.value = (e as Error).message
  }
}

// Market — results from every provider are searched together and mixed.
const PROVIDERS: BlueprintMarketProvider[] = ['mcschematic', 'cms', 'minecraft-schematics']
const marketItems = ref<BlueprintMarketItem[]>([])
const marketState = ref<Record<string, { page: number; hasMore: boolean }>>({})
const marketHasMore = computed(() => Object.values(marketState.value).some((s) => s.hasMore))
const marketLoading = ref(false)
const installing = ref('')

function resetMarket() {
  marketItems.value = []
  marketState.value = Object.fromEntries(PROVIDERS.map((p) => [p, { page: 0, hasMore: true }]))
  loadMoreMarket()
}
async function loadMoreMarket() {
  if (marketLoading.value || !isRemote.value) return
  const toLoad = PROVIDERS.filter((p) => marketState.value[p]?.hasMore)
  if (toLoad.length === 0) return
  marketLoading.value = true
  try {
    const results = await Promise.allSettled(toLoad.map((p) =>
      marketSearch({ provider: p, keyword: keyword.value, page: marketState.value[p].page })))
    const lists: BlueprintMarketItem[][] = []
    let failures = 0
    results.forEach((res, i) => {
      const p = toLoad[i]
      const prev = marketState.value[p]
      if (res.status === 'fulfilled') {
        lists.push(res.value.items)
        marketState.value[p] = { page: prev.page + 1, hasMore: res.value.hasMore }
      } else {
        failures += 1
        marketState.value[p] = { page: prev.page, hasMore: false }
      }
    })
    // Interleave provider results so the mixed list alternates between sources.
    const mixed: BlueprintMarketItem[] = []
    const maxLen = Math.max(0, ...lists.map((l) => l.length))
    for (let i = 0; i < maxLen; i++) {
      for (const l of lists) {
        if (l[i]) mixed.push(l[i])
      }
    }
    marketItems.value = [...marketItems.value, ...mixed]
    if (failures === toLoad.length && marketItems.value.length === 0) {
      errorText.value = 'Failed to search blueprint market.'
    }
  } finally {
    marketLoading.value = false
  }
}
watch([isRemote, keyword], () => { if (isRemote.value) resetMarket() }, { immediate: true })
async function installFromMarket(item: BlueprintMarketItem) {
  installing.value = item.id
  try {
    // `item` is a Vue reactive proxy; pass a plain clone so it can be
    // structured-cloned across the IPC boundary.
    await marketInstallSvc({ instancePath: path.value, item: { ...item } })
    revalidate()
  } catch (e) {
    errorText.value = (e as Error).message
  } finally {
    installing.value = ''
  }
}

function openLink(url: string) {
  window.open(url, 'browser')
}
</script>

<style scoped>
.blueprint-mat-icon {
  width: 22px;
  height: 22px;
  object-fit: contain;
  image-rendering: pixelated;
}

.blueprint-ns-filter {
  max-width: 160px;
  flex: 0 0 auto;
}
</style>
