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
    <template #actions>
      <div class="flex items-center gap-2 px-2 py-1">
        <v-btn-toggle
          v-model="source"
          mandatory
          density="compact"
          variant="outlined"
          @update:model-value="selectId('')"
        >
          <v-btn value="" data-testid="blueprint-local-tab">
            {{ t('blueprint.local') }}
          </v-btn>
          <v-btn value="market" data-testid="blueprint-market-tab">
            {{ t('blueprint.market') }}
          </v-btn>
        </v-btn-toggle>
        <v-spacer />
        <v-btn-toggle
          v-if="isRemote"
          v-model="marketProvider"
          mandatory
          density="compact"
          variant="outlined"
        >
          <v-btn value="mcschematic">
            MCS
          </v-btn>
          <v-btn value="cms">
            CMS
          </v-btn>
        </v-btn-toggle>
      </div>
      <v-alert
        v-if="isRemote && marketProvider === 'cms'"
        type="info"
        density="compact"
        class="mx-2 mb-1"
      >
        {{ t('blueprint.cmsBrowseOnly') }}
      </v-alert>
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
        data-testid="blueprint-market-item"
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
          <v-chip v-if="asMarket(rawItem).fileType" size="x-small" label>
            {{ asMarket(rawItem).fileType }}
          </v-chip>
          <span v-if="asMarket(rawItem).author">{{ asMarket(rawItem).author }}</span>
          <span v-if="asMarket(rawItem).downloadCount !== undefined">· ↓ {{ asMarket(rawItem).downloadCount }}</span>
        </v-list-item-subtitle>
        <template #append>
          <div class="flex gap-1">
            <v-btn
              v-if="asMarket(rawItem).installable"
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="file_download"
              :loading="installing === asMarket(rawItem).id"
              @click="installFromMarket(asMarket(rawItem))"
            >
              {{ t('blueprint.install') }}
            </v-btn>
            <v-btn
              v-if="asMarket(rawItem).pageUrl"
              size="small"
              variant="text"
              prepend-icon="open_in_new"
              @click="openLink(asMarket(rawItem).pageUrl!)"
            >
              {{ t('blueprint.goTo') }}
            </v-btn>
          </div>
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
            v-if="active.voxels && active.dimensions && active.palette"
            :key="active.path"
            :instance-path="path"
            :size="active.dimensions"
            :palette="active.palette"
            :voxels="active.voxels"
          />
          <div v-else class="flex items-center justify-center h-full opacity-50">
            {{ t('blueprint.preview.loading') }}
          </div>
        </div>
        <div class="flex-grow overflow-auto px-3">
          <div class="text-subtitle-2 mb-1">
            {{ t('blueprint.materials') }}
          </div>
          <v-list density="compact" class="bg-transparent">
            <v-list-item v-for="m in (active.materials ?? [])" :key="m.block" class="px-0 min-h-0">
              <v-list-item-title class="text-sm">
                {{ m.block }}
              </v-list-item-title>
              <template #append>
                <span class="text-sm opacity-70">{{ m.count }}</span>
              </template>
            </v-list-item>
          </v-list>
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

const { t } = useI18n()
const { path } = injection(kInstance)
const { blueprints, isValidating, revalidate } = useInstanceBlueprints(path)
const { uninstall, convertBlueprint, replaceBlueprintBlocks } = useService(InstanceBlueprintsServiceKey)
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
const asBp = (i: unknown) => i as BlueprintEntry
const asMarket = (i: unknown) => (i as MarketEntry).market
const isMarketEntry = (i: unknown) => typeof i === 'object' && i !== null && 'market' in i
const selectId = (v: string) => { selectedId.value = v }

const refreshFlag = useQuery('refresh')
watch(refreshFlag, () => revalidate())

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

// Selected blueprint detail (right pane)
const materials = computed(() => active.value?.materials ?? [])

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

// Market
const marketProvider = useQuery('provider') as unknown as Ref<BlueprintMarketProvider>
const marketItems = ref<BlueprintMarketItem[]>([])
const marketPage = ref(0)
const marketHasMore = ref(false)
const marketLoading = ref(false)
const installing = ref('')

function resetMarket() {
  marketItems.value = []
  marketPage.value = 0
  marketHasMore.value = false
  loadMoreMarket()
}
async function loadMoreMarket() {
  if (marketLoading.value || !isRemote.value) return
  marketLoading.value = true
  try {
    const result = await marketSearch({ provider: marketProvider.value || 'mcschematic', keyword: keyword.value, page: marketPage.value })
    marketItems.value = [...marketItems.value, ...result.items]
    marketHasMore.value = result.hasMore
    marketPage.value += 1
  } catch (e) {
    errorText.value = (e as Error).message
  } finally {
    marketLoading.value = false
  }
}
watch([isRemote, marketProvider, keyword], () => { if (isRemote.value) resetMarket() }, { immediate: true })
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
