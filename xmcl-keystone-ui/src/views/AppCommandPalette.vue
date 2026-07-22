<template>
  <v-dialog
    v-model="isShown"
    width="720"
    max-width="92vw"
    transition="dialog-top-transition"
    scrollable
  >
    <v-card
      class="palette-card flex max-h-[75vh] flex-col overflow-hidden"
    >
      <v-text-field
        ref="searchInput"
        v-model="query"
        data-testid="command-palette-input"
        :placeholder="t('commandPalette.placeholder')"
        prepend-inner-icon="search"
        variant="solo"
        density="comfortable"
        rounded="lg"
        flat
        bg-color="transparent"
        hide-details
        :readonly="!!pendingInstancePath"
        autofocus
        class="pa-3"
        @keydown.down.prevent="moveSelection(1)"
        @keydown.up.prevent="moveSelection(-1)"
        @keydown.right="onArrowForward"
        @keydown.left="onArrowBack"
        @keydown.enter.prevent="invokeSelected"
        @keydown.esc="hide"
      />

      <v-progress-linear
        :active="isSearchingMarket"
        indeterminate
        height="2"
        color="primary"
        class="palette-progress"
      />

      <v-divider />

      <v-list
        ref="resultsList"
        density="compact"
        nav
        class="palette-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2"
      >
        <template v-if="recentResults.length > 0">
          <div role="group" :aria-label="t('commandPalette.recent')">
            <v-list-subheader>{{ t('commandPalette.recent') }}</v-list-subheader>
            <v-list-item
              v-for="(inst, idx) in recentResults"
              :key="`recent-${inst.path}`"
              :active="selectedIndex === idx"
              :data-palette-index="idx"
              :aria-label="`${inst.name} (Minecraft ${inst.runtime.minecraft})`"
              @click="enterInstanceMenu(inst)"
              @mouseenter="selectedIndex = idx"
            >
              <template #prepend>
                <v-avatar size="36" rounded="lg" class="palette-avatar">
                  <v-img
                    v-fallback-img="BuiltinImages.craftingTable"
                    :src="getInstanceIcon(inst, undefined)"
                  />
                </v-avatar>
              </template>
              <v-list-item-title>{{ inst.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ inst.runtime.minecraft }} · {{ inst.path }}</v-list-item-subtitle>
              <template #append>
                <v-icon size="small" color="primary" aria-hidden="true">arrow_right</v-icon>
              </template>
            </v-list-item>
          </div>
        </template>

        <template v-if="commandResults.length > 0">
          <div role="group" :aria-label="t('commandPalette.commands')">
            <v-list-subheader>{{ t('commandPalette.commands') }}</v-list-subheader>
            <v-list-item
              v-for="(c, idx) in commandResults"
              :key="c.id"
              :active="selectedIndex === recentResults.length + idx"
              :data-palette-index="recentResults.length + idx"
              @click="invoke(c)"
              @mouseenter="selectedIndex = recentResults.length + idx"
            >
              <template #prepend>
                <div class="palette-cmd-icon">
                  <v-icon size="18">{{ c.ui?.icon || 'play_arrow' }}</v-icon>
                </div>
              </template>
              <v-list-item-title>{{ c.title }}</v-list-item-title>
              <v-list-item-subtitle>{{ c.description }}</v-list-item-subtitle>
            </v-list-item>
          </div>
        </template>

        <template v-if="settingsResults.length > 0">
          <div role="group" :aria-label="t('setting.name', 2)">
          <v-list-subheader>{{ t('setting.name', 2) }}</v-list-subheader>
          <v-list-item
            v-for="(s, idx) in settingsResults"
            :key="s.id"
            :active="selectedIndex === recentResults.length + commandResults.length + idx"
            :data-palette-index="recentResults.length + commandResults.length + idx"
            @click="invokeSetting(s)"
            @mouseenter="selectedIndex = recentResults.length + commandResults.length + idx"
          >
            <template #prepend>
              <div class="palette-cmd-icon">
                <v-icon size="18">{{ s.icon || 'settings' }}</v-icon>
              </div>
            </template>
            <v-list-item-title>
              <span class="palette-setting-title">
                <span class="palette-setting-title__text">{{ s.title }}</span>
                <v-chip
                  v-if="s.chip"
                  class="palette-setting-chip"
                  label
                  size="x-small"
                  variant="tonal"
                  :prepend-icon="s.chip.icon"
                  :color="s.chip.color"
                >
                  {{ s.chip.text }}
                </v-chip>
              </span>
            </v-list-item-title>
            <v-list-item-subtitle>{{ s.group }} · {{ s.description }}</v-list-item-subtitle>
            <template #append>
              <v-switch
                v-if="s.kind === 'switch'"
                :model-value="s.value"
                color="primary"
                hide-details
                density="compact"
                inset
                class="palette-switch"
                @click.stop
                @update:model-value="s.value = !!$event"
              />
              <span
                v-else
                class="palette-select-current"
              >
                <span class="text-caption text-medium-emphasis">
                  {{ s.items.find((i) => i.value === s.value)?.text ?? s.value }}
                </span>
                <v-icon size="small" color="primary">arrow_right</v-icon>
              </span>
            </template>
          </v-list-item>
          </div>
        </template>

        <template v-if="pendingSetting && pendingSetting.kind === 'select'">
          <v-list-subheader>{{ pendingSetting.title }}</v-list-subheader>
          <v-list-item
            v-for="(opt, idx) in settingOptionResults"
            :key="opt.value || '__empty__'"
            :active="selectedIndex === idx"
            :data-palette-index="idx"
            @click="applySettingOption(opt)"
            @mouseenter="selectedIndex = idx"
          >
            <template #prepend>
              <div class="palette-cmd-icon">
                <v-icon
                  size="18"
                  :color="opt.value === pendingSetting.value ? 'primary' : undefined"
                >
                  {{ opt.value === pendingSetting.value ? 'radio_button_checked' : 'radio_button_unchecked' }}
                </v-icon>
              </div>
            </template>
            <v-list-item-title>{{ opt.text }}</v-list-item-title>
          </v-list-item>
        </template>

        <template v-if="pendingInstance">
          <v-list-subheader>{{ pendingInstance.name }}</v-list-subheader>
          <v-list-item
            :active="selectedIndex === 0"
            data-palette-index="0"
            data-testid="command-palette-instance-select"
            @click="selectInstance(pendingInstance)"
            @mouseenter="selectedIndex = 0"
          >
            <template #prepend>
              <div class="palette-cmd-icon">
                <v-icon size="18">open_in_new</v-icon>
              </div>
            </template>
            <v-list-item-title>{{ t('setting.select') }}</v-list-item-title>
            <v-list-item-subtitle>{{ pendingInstance.runtime.minecraft }} · {{ pendingInstance.path }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item
            :active="selectedIndex === 1"
            data-palette-index="1"
            data-testid="command-palette-instance-launch"
            @click="launchInstance(pendingInstance)"
            @mouseenter="selectedIndex = 1"
          >
            <template #prepend>
              <div class="palette-cmd-icon">
                <v-icon size="18">play_arrow</v-icon>
              </div>
            </template>
            <v-list-item-title>{{ t('launch.launch') }}</v-list-item-title>
            <v-list-item-subtitle>{{ pendingInstance.runtime.minecraft }} · {{ pendingInstance.path }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item
            :active="selectedIndex === 2"
            data-palette-index="2"
            data-testid="command-palette-instance-duplicate"
            @click="duplicateInstance(pendingInstance)"
            @mouseenter="selectedIndex = 2"
          >
            <template #prepend>
              <div class="palette-cmd-icon">
                <v-icon size="18">file_copy</v-icon>
              </div>
            </template>
            <v-list-item-title>{{ t('instance.duplicate') }}</v-list-item-title>
            <v-list-item-subtitle>{{ pendingInstance.runtime.minecraft }} · {{ pendingInstance.path }}</v-list-item-subtitle>
          </v-list-item>
          <v-list-item
            :active="selectedIndex === 3"
            data-palette-index="3"
            data-testid="command-palette-instance-delete"
            @click="deleteInstance(pendingInstance)"
            @mouseenter="selectedIndex = 3"
          >
            <template #prepend>
              <div class="palette-cmd-icon">
                <v-icon size="18" color="error">delete</v-icon>
              </div>
            </template>
            <v-list-item-title>{{ t('instance.delete') }}</v-list-item-title>
            <v-list-item-subtitle>{{ pendingInstance.runtime.minecraft }} · {{ pendingInstance.path }}</v-list-item-subtitle>
          </v-list-item>
        </template>

        <template v-if="instanceResults.length > 0">
          <div role="group" :aria-label="t('commandPalette.instances')">
            <v-list-subheader>{{ t('commandPalette.instances') }}</v-list-subheader>
            <v-list-item
              v-for="(inst, idx) in instanceResults"
              :key="inst.path"
              data-testid="command-palette-instance"
              :active="selectedIndex === recentResults.length + commandResults.length + settingsResults.length + idx"
              :data-palette-index="recentResults.length + commandResults.length + settingsResults.length + idx"
              :aria-label="`${pendingInstanceAction ? `${instanceActionLabel}: ` : ''}${inst.name} (Minecraft ${inst.runtime.minecraft})`"
              @click="pendingInstanceAction ? launchInstance(inst) : enterInstanceMenu(inst)"
              @mouseenter="selectedIndex = recentResults.length + commandResults.length + settingsResults.length + idx"
            >
              <template #prepend>
                <v-avatar size="36" rounded="lg" class="palette-avatar">
                  <v-img
                    v-fallback-img="BuiltinImages.craftingTable"
                    :src="getInstanceIcon(inst, undefined)"
                  />
                </v-avatar>
              </template>
              <v-list-item-title>{{ inst.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ inst.runtime.minecraft }} · {{ inst.path }}</v-list-item-subtitle>
              <template #append>
                <v-icon
                  size="small"
                  :color="pendingInstanceAction ? instanceActionColor : 'primary'"
                  aria-hidden="true"
                >
                  {{ pendingInstanceAction ? instanceActionIcon : 'arrow_right' }}
                </v-icon>
              </template>
            </v-list-item>
          </div>
        </template>

        <v-list-item
          v-if="showAiResult"
          :active="selectedIndex === preMarketResultCount"
          :data-palette-index="preMarketResultCount"
          data-testid="command-palette-ask-ai"
          :aria-label="`${t('agent.title')}: ${query.trim()}`"
          @click="askAi"
          @mouseenter="selectedIndex = preMarketResultCount"
        >
          <template #prepend>
            <div class="palette-cmd-icon palette-ai-icon">
              <v-icon size="18">auto_awesome</v-icon>
            </div>
          </template>
          <v-list-item-title>{{ t('agent.title') }}</v-list-item-title>
          <v-list-item-subtitle class="palette-ai-query">{{ query.trim() }}</v-list-item-subtitle>
          <template #append>
            <span class="text-caption text-medium-emphasis">{{ t('commandPalette.hintInvoke') }}</span>
          </template>
        </v-list-item>

        <template v-if="!pendingInstanceAction && !pendingInstancePath && !pendingSettingId && modrinthResults.length > 0">
          <div role="group" :aria-label="t('commandPalette.modrinth')">
          <v-list-subheader>{{ t('commandPalette.modrinth') }}</v-list-subheader>
          <v-list-item
            v-for="(p, idx) in modrinthResults"
            :key="p.project_id"
            :active="selectedIndex === preMarketResultCount + (showAiResult ? 1 : 0) + idx"
            :data-palette-index="preMarketResultCount + (showAiResult ? 1 : 0) + idx"
            @click="openModrinthProject(p)"
            @mouseenter="selectedIndex = preMarketResultCount + (showAiResult ? 1 : 0) + idx"
          >
            <template #prepend>
              <v-avatar size="36" rounded="lg" class="palette-avatar">
                <v-img v-if="p.icon_url" :src="p.icon_url" />
                <v-icon v-else>{{ getProjectTypeIcon(p.project_type) }}</v-icon>
              </v-avatar>
            </template>
            <v-list-item-title>{{ p.title }}</v-list-item-title>
            <v-list-item-subtitle>{{ p.description }}</v-list-item-subtitle>
            <template #append>
              <v-chip
                size="x-small"
                variant="tonal"
                label
                :color="getProjectTypeColor(p.project_type)"
              >
                <v-icon start size="x-small">{{ getProjectTypeIcon(p.project_type) }}</v-icon>
                {{ getProjectTypeLabel(p.project_type) }}
              </v-chip>
            </template>
          </v-list-item>
          </div>
        </template>

        <v-list-item
          v-if="!hasAnyResult && !isSearchingMarket"
          disabled
        >
          <v-list-item-title class="text-medium-emphasis">
            {{ query.trim() ? t('commandPalette.noResults') : t('commandPalette.empty') }}
          </v-list-item-title>
        </v-list-item>
      </v-list>

      <v-divider />

      <div class="palette-footer px-4 py-2 text-medium-emphasis text-caption flex items-center gap-2 flex-wrap">
        <span class="palette-footer__group">
          <kbd>↑</kbd><kbd>↓</kbd>
          <span class="palette-footer__label">{{ t('commandPalette.hintNavigate') }}</span>
        </span>
        <span class="palette-footer__group">
          <kbd>Enter</kbd>
          <span class="palette-footer__label">{{ t('commandPalette.hintInvoke') }}</span>
        </span>
        <span v-if="pendingInstanceAction || pendingInstancePath || pendingSettingId" class="palette-footer__group">
          <kbd>←</kbd>
          <span class="palette-footer__label">{{ t('commandPalette.hintBack') }}</span>
        </span>
        <span v-else-if="isSelectedCommandMultiStep" class="palette-footer__group">
          <kbd>→</kbd>
          <span class="palette-footer__label">{{ t('commandPalette.hintEnter') }}</span>
        </span>
        <span class="palette-footer__group">
          <kbd>Esc</kbd>
          <span class="palette-footer__label">{{ t('commandPalette.hintClose') }}</span>
        </span>
        <v-spacer />
        <span class="palette-footer__group">
          <kbd>Ctrl</kbd><kbd>K</kbd>
        </span>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useNotifier } from '@/composables/notifier'
import { useLocaleError } from '@/composables/error'
import { useAgentChatBus } from '@/composables/agentChat'
import { useCommandPaletteBus, useCommandPaletteVisible } from '@/composables/commandPalette'
import { useRendererCommandHost } from '@/composables/commandHost'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { useModrinthSearchFunc } from '@/composables/modrinth'
import { useService } from '@/composables/service'
import type { SettingsSearchItem } from '@/composables/settingsSearch'
import { useSettingsSearchItems } from '@/composables/settingsSearch'
import { BuiltinImages } from '@/constant'
import { vFallbackImg } from '@/directives/fallbackImage'
import { getInstanceIcon } from '@/util/favicon'
import { injection } from '@/util/inject'
import { useDebounce } from '@vueuse/core'
import type { Instance } from '@xmcl/instance'
import type { SearchResultHit } from '@xmcl/modrinth'
import { InstanceServiceKey } from '@xmcl/runtime-api'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useRtl } from 'vuetify'

const { t, te, locale } = useI18n()
const isShown = useCommandPaletteVisible()
const query = ref('')
const debouncedQuery = useDebounce(query, 250)
const selectedIndex = ref(0)
const router = useRouter()
const bus = useCommandPaletteBus()
const agentChatBus = useAgentChatBus()
const { notify } = useNotifier()
const tError = useLocaleError()

const host = useRendererCommandHost()
const { duplicateInstance: duplicateInstanceService } = useService(InstanceServiceKey)
const instanceCtx = injection(kInstance)
const instancesCtx = injection(kInstances)
const pendingInstanceAction = ref<'instance.launch' | 'instance.delete' | undefined>(undefined)
const pendingInstancePath = ref<string | undefined>(undefined)
const settingsItems = useSettingsSearchItems()
const pendingSettingId = ref<string | undefined>(undefined)

bus.on((event) => {
  if (event === 'show') isShown.value = true
  else if (event === 'hide') isShown.value = false
  else isShown.value = !isShown.value
})

watch(isShown, (v) => {
  if (v) {
    query.value = ''
    selectedIndex.value = 0
    pendingInstanceAction.value = undefined
    pendingInstancePath.value = undefined
    pendingSettingId.value = undefined
  }
})

function hide() {
  isShown.value = false
  pendingInstanceAction.value = undefined
  pendingInstancePath.value = undefined
  pendingSettingId.value = undefined
}

// ── Internal commands ────────────────────────────────────────────────────────
const allCommands = computed(() =>
  host.list()
)

function fuzzyMatches(haystack: string, needle: string): boolean {
  if (!needle) return true
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  let i = 0
  for (const ch of h) {
    if (ch === n[i]) i++
    if (i === n.length) return true
  }
  return false
}

const commandResults = computed(() => {
  if (pendingInstanceAction.value || pendingInstancePath.value || pendingSettingId.value) return []
  const q = query.value.trim()
  return allCommands.value.filter((c) =>
    fuzzyMatches(c.title, q) || fuzzyMatches(c.id, q),
  ).slice(0, 8)
})

// ── Recent instances ((default view only) ─────────────────────────────────────
const recentResults = computed(() => {
  if (pendingInstanceAction.value || pendingInstancePath.value || pendingSettingId.value) return []
  if (query.value.trim()) return []
  return [...instancesCtx.instances.value]
    .filter((i) => (i.lastPlayedDate ?? 0) > 0)
    .sort((a, b) => (b.lastPlayedDate ?? 0) - (a.lastPlayedDate ?? 0))
    .slice(0, 5)
})

// ── Settings results ─────────────────────────────────────────────────────────
const pendingSetting = computed(() =>
  settingsItems.value.find((it) => it.id === pendingSettingId.value),
)

const pendingInstance = computed(() =>
  instancesCtx.instances.value.find((it) => it.path === pendingInstancePath.value),
)

const settingsResults = computed<SettingsSearchItem[]>(() => {
  if (pendingInstanceAction.value || pendingInstancePath.value || pendingSettingId.value) return []
  const q = query.value.trim()
  if (!q) return []
  return settingsItems.value.filter((it) =>
    fuzzyMatches(it.title, q) ||
    fuzzyMatches(it.id, q) ||
    fuzzyMatches(it.keywords, q) ||
    fuzzyMatches(it.description, q),
  ).slice(0, 8)
})

const settingOptionResults = computed(() => {
  const cur = pendingSetting.value
  if (!cur || cur.kind !== 'select') return [] as { text: string; value: string }[]
  const q = query.value.trim()
  if (!q) return cur.items
  return cur.items.filter((it) =>
    fuzzyMatches(it.text, q) || fuzzyMatches(it.value, q),
  )
})

// ── Instance results ─────────────────────────────────────────────────────────
const instanceResults = computed(() => {
  const currentPath = instanceCtx.path.value
  const sorted = [...instancesCtx.instances.value].sort((left, right) => {
    if (left.path === currentPath) return -1
    if (right.path === currentPath) return 1
    return left.name.localeCompare(right.name)
  })
  const q = query.value.trim()
  if (pendingSettingId.value || pendingInstancePath.value) return []
  if (!pendingInstanceAction.value && !q) return []
  const filtered = sorted.filter((i) =>
    !q || fuzzyMatches(i.name, q) || fuzzyMatches(i.path, q),
  )
  return pendingInstanceAction.value ? filtered : filtered.slice(0, 5)
})

// ── Modrinth search ──────────────────────────────────────────────────────────
const searchModrinth = useModrinthSearchFunc(
  computed(() => debouncedQuery.value.trim()),
  ref(''),
  ref(''),
  ref([] as string[]),
  ref([] as string[]),
  ref(''),
  ref(undefined as string | undefined),
  ref(''),
  ref(8),
)

const modrinthResults = ref<SearchResultHit[]>([])
const isSearchingMarket = ref(false)

watch(debouncedQuery, async (q) => {
  modrinthResults.value = []
  if (!isShown.value) return
  if (pendingInstanceAction.value || pendingInstancePath.value || pendingSettingId.value) return
  if (!q || q.length < 2) return
  isSearchingMarket.value = true
  try {
    const r = await searchModrinth(0)
    if (pendingInstanceAction.value || pendingInstancePath.value || pendingSettingId.value) return
    modrinthResults.value = r.hits
  } catch {
    // Silently ignore network errors — palette stays usable.
  } finally {
    isSearchingMarket.value = false
  }
})

// ── Selection / invocation ───────────────────────────────────────────────────
const preMarketResultCount = computed(() =>
  recentResults.value.length + commandResults.value.length + settingsResults.value.length + instanceResults.value.length,
)
const normalResultCount = computed(() =>
  preMarketResultCount.value + modrinthResults.value.length,
)
const showAiResult = computed(() => {
  if (pendingInstanceAction.value || pendingInstancePath.value || pendingSettingId.value) return false
  return query.value.trim().length >= 2
})

const totalResultCount = computed(() => {
  if (pendingInstancePath.value) return pendingInstance.value ? 4 : 0
  if (pendingSettingId.value) return settingOptionResults.value.length
  if (pendingInstanceAction.value) return instanceResults.value.length
  return normalResultCount.value + (showAiResult.value ? 1 : 0)
})
const hasAnyResult = computed(() => totalResultCount.value > 0)

watch([recentResults, commandResults, settingsResults, instanceResults, modrinthResults, settingOptionResults, pendingInstancePath, showAiResult], () => {
  if (selectedIndex.value >= totalResultCount.value) selectedIndex.value = 0
})

function moveSelection(delta: number) {
  const total = totalResultCount.value
  if (total === 0) return
  selectedIndex.value = (selectedIndex.value + delta + total) % total
}

const resultsList = ref<{ $el: HTMLElement } | null>(null)

watch(selectedIndex, (idx) => {
  nextTick(() => {
    const root = resultsList.value?.$el as HTMLElement | undefined
    if (!root) return
    const target = root.querySelector(`[data-palette-index="${idx}"]`) as HTMLElement | null
    target?.scrollIntoView({ block: 'nearest' })
  })
})

async function invoke(c: { id: string }) {
  if (c.id === 'instance.launch' || c.id === 'instance.delete') {
    pendingInstanceAction.value = c.id
    pendingInstancePath.value = undefined
    query.value = ''
    selectedIndex.value = 0
    return
  }

  hide()
  try {
    await host.dispatch(c.id, {})
  } catch (e) {
    notify({ title: tError(e), level: 'error' })
  }
}

function askAi() {
  const prompt = query.value.trim()
  if (!prompt) return
  hide()
  agentChatBus.emit({ type: 'show', prompt })
}

function enterInstanceMenu(inst: Instance) {
  pendingInstanceAction.value = undefined
  pendingInstancePath.value = inst.path
  selectedIndex.value = 0
}

async function launchInstance(inst: Instance) {
  const commandId = pendingInstanceAction.value ?? 'instance.launch'
  hide()
  try {
    await host.dispatch(commandId, { instance: inst.path })
  } catch (e) {
    notify({ title: tError(e), level: 'error' })
  }
}

async function selectInstance(inst: Instance) {
  hide()
  if (router.currentRoute.value.path !== '/') {
    await router.push('/')
  }
  instanceCtx.select(inst.path)
}

async function duplicateInstance(inst: Instance) {
  hide()
  try {
    await duplicateInstanceService(inst.path)
  } catch (e) {
    notify({ title: tError(e), level: 'error' })
  }
}

async function deleteInstance(inst: Instance) {
  hide()
  try {
    await host.dispatch('instance.delete', { instance: inst.path })
  } catch (e) {
    notify({ title: tError(e), level: 'error' })
  }
}

async function openModrinthProject(p: SearchResultHit) {
  hide()
  await nextTick()
  const localRoute = localPageForProjectType(p.project_type)
  if (localRoute) {
    await router.push({
      path: localRoute,
      query: {
        source: 'remote',
        keyword: p.title,
        id: `modrinth:${p.project_id}`,
      },
    })
  } else {
    await router.push(`/store/modrinth/${p.project_id}`)
  }
}

function localPageForProjectType(type: string): string | undefined {
  switch (type) {
    case 'mod': return '/mods'
    case 'resourcepack': return '/resourcepacks'
    case 'shader': return '/shaderpacks'
    default: return undefined
  }
}

function invokeSetting(s: SettingsSearchItem) {
  if (s.kind === 'switch') {
    s.value = !s.value
    return
  }
  pendingSettingId.value = s.id
  query.value = ''
  selectedIndex.value = 0
}

function applySettingOption(option: { value: string }) {
  const cur = pendingSetting.value
  if (!cur || cur.kind !== 'select') return
  cur.value = option.value
  hide()
}

function invokeSelected() {
  if (pendingInstancePath.value) {
    const inst = pendingInstance.value
    if (!inst) return
    if (selectedIndex.value === 0) {
      selectInstance(inst)
    } else if (selectedIndex.value === 1) {
      launchInstance(inst)
    } else if (selectedIndex.value === 2) {
      duplicateInstance(inst)
    } else {
      deleteInstance(inst)
    }
    return
  }
  if (pendingSettingId.value) {
    const opt = settingOptionResults.value[selectedIndex.value]
    if (opt) applySettingOption(opt)
    return
  }
  const recentLen = recentResults.value.length
  const cmdLen = commandResults.value.length
  const setLen = settingsResults.value.length
  const instLen = instanceResults.value.length
  const idx = selectedIndex.value
  if (idx < recentLen) {
    enterInstanceMenu(recentResults.value[idx])
  } else if (idx < recentLen + cmdLen) {
    invoke(commandResults.value[idx - recentLen])
  } else if (idx < recentLen + cmdLen + setLen) {
    invokeSetting(settingsResults.value[idx - recentLen - cmdLen])
  } else if (idx < recentLen + cmdLen + setLen + instLen) {
    const inst = instanceResults.value[idx - recentLen - cmdLen - setLen]
    if (pendingInstanceAction.value) {
      launchInstance(inst)
    } else {
      enterInstanceMenu(inst)
    }
  } else if (showAiResult.value && idx === preMarketResultCount.value) {
    askAi()
  } else if (idx < preMarketResultCount.value + (showAiResult.value ? 1 : 0) + modrinthResults.value.length) {
    openModrinthProject(modrinthResults.value[idx - preMarketResultCount.value - (showAiResult.value ? 1 : 0)])
  }
}

const multiStepCommandIds = new Set(['instance.launch', 'instance.delete'])

const projectTypeMeta: Record<string, { icon: string; color: string }> = {
  mod: { icon: 'extension', color: 'primary' },
  modpack: { icon: 'inventory_2', color: 'orange' },
  resourcepack: { icon: 'palette', color: 'purple' },
  shader: { icon: 'wb_sunny', color: 'amber' },
  datapack: { icon: 'data_object', color: 'teal' },
  plugin: { icon: 'power', color: 'green' },
}

function getProjectTypeIcon(type: string) {
  return projectTypeMeta[type]?.icon ?? 'extension'
}
function getProjectTypeColor(type: string) {
  return projectTypeMeta[type]?.color ?? 'grey'
}
function getProjectTypeLabel(type: string) {
  // Read locale.value so this re-evaluates when the active language changes.
  void locale.value
  const key = `modrinth.projectType.${type}`
  return te(key) ? t(key) : type
}

const instanceActionIcon = computed(() => pendingInstanceAction.value === 'instance.delete' ? 'delete' : 'play_arrow')
const instanceActionColor = computed(() => pendingInstanceAction.value === 'instance.delete' ? 'error' : 'primary')
const instanceActionLabel = computed(() => pendingInstanceAction.value === 'instance.delete' ? t('delete.yes') : t('launch.launch'))

const isSelectedCommandMultiStep = computed(() => {
  if (pendingInstanceAction.value || pendingInstancePath.value || pendingSettingId.value) return false
  const recentLen = recentResults.value.length
  const cmdLen = commandResults.value.length
  if (selectedIndex.value < recentLen) return true
  const localIdx = selectedIndex.value - recentLen
  if (localIdx >= 0 && localIdx < cmdLen) {
    const cmd = commandResults.value[localIdx]
    return !!cmd && multiStepCommandIds.has(cmd.id)
  }
  const settingIdx = selectedIndex.value - recentLen - cmdLen
  const setting = settingsResults.value[settingIdx]
  if (setting && setting.kind === 'select') return true
  const instanceIdx = selectedIndex.value - recentLen - cmdLen - settingsResults.value.length
  return instanceIdx >= 0 && instanceIdx < instanceResults.value.length
})

function onArrowRight(e: KeyboardEvent) {
  if (pendingInstanceAction.value || pendingInstancePath.value || pendingSettingId.value) return
  const recentLen = recentResults.value.length
  const cmdLen = commandResults.value.length
  if (selectedIndex.value < recentLen) {
    e.preventDefault()
    enterInstanceMenu(recentResults.value[selectedIndex.value])
    return
  }
  const localIdx = selectedIndex.value - recentLen
  if (localIdx >= 0 && localIdx < cmdLen) {
    const cmd = commandResults.value[localIdx]
    if (cmd && multiStepCommandIds.has(cmd.id)) {
      e.preventDefault()
      invoke(cmd)
    }
    return
  }
  const setting = settingsResults.value[selectedIndex.value - recentLen - cmdLen]
  if (setting && setting.kind === 'select') {
    e.preventDefault()
    invokeSetting(setting)
    return
  }
  const instanceIdx = selectedIndex.value - recentLen - cmdLen - settingsResults.value.length
  const inst = instanceResults.value[instanceIdx]
  if (inst) {
    e.preventDefault()
    enterInstanceMenu(inst)
  }
}

function onArrowLeft(e: KeyboardEvent) {
  if (!pendingInstanceAction.value && !pendingInstancePath.value && !pendingSettingId.value) return
  const target = e.target as HTMLInputElement | null
  // Allow normal cursor movement when there's text and the cursor isn't at the start.
  if (!pendingInstancePath.value && target && target.value && (target.selectionStart ?? 0) > 0) return
  e.preventDefault()
  pendingInstanceAction.value = undefined
  pendingInstancePath.value = undefined
  pendingSettingId.value = undefined
  selectedIndex.value = 0
}

// Mirror drill-in / back-out arrow keys under RTL so the gesture follows
// the visible reading direction.
const { isRtl: paletteIsRtl } = useRtl()
function onArrowForward(e: KeyboardEvent) {
  return paletteIsRtl.value ? onArrowLeft(e) : onArrowRight(e)
}
function onArrowBack(e: KeyboardEvent) {
  return paletteIsRtl.value ? onArrowRight(e) : onArrowLeft(e)
}
</script>

<style scoped>
.palette-card {
  border-radius: 18px;
}

.palette-progress {
  position: relative;
  z-index: 1;
}

.palette-list :deep(.v-list-item) {
  border-radius: 12px;
  margin-bottom: 2px;
  min-height: 48px;
  transition: background-color 120ms ease, transform 120ms ease;
}

.palette-list :deep(.v-list-subheader) {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.55;
  min-height: 24px;
  padding-inline-start: 12px;
  padding-inline-end: 12px;
  margin-top: 4px;
}

.palette-list :deep(.v-list-item--active .v-list-item__overlay) {
  opacity: 0.12;
}

.palette-list :deep(.v-list-item__prepend) {
  margin-inline-end: 12px;
}

.palette-list :deep(.v-list-item__prepend > .v-list-item__spacer) {
  width: 12px;
}

.palette-avatar {
  background: rgba(125, 125, 125, 0.12);
}

.palette-cmd-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: rgba(125, 125, 125, 0.14);
  color: rgb(var(--v-theme-on-surface));
}

.palette-ai-icon {
  color: rgb(var(--v-theme-primary));
  background: rgb(var(--v-theme-primary) / 0.1);
}

.palette-ai-query {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-switch {
  margin: 0;
  padding: 0;
  flex: none;
}

.palette-switch :deep(.v-input__control) {
  min-height: 0;
}

.palette-setting-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.palette-setting-title__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.palette-setting-chip {
  flex: none;
}

.palette-select-current {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 200px;
}

.palette-select-current > span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.palette-footer {
  background: rgb(var(--v-theme-surface-bright, var(--v-theme-surface)) / 0.4);
}

.palette-footer__group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.palette-footer__label {
  margin-left: 2px;
  opacity: 0.8;
}

kbd {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.7rem;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 6px;
  border: 1px solid rgba(125, 125, 125, 0.28);
  background: rgba(125, 125, 125, 0.14);
  min-width: 18px;
  text-align: center;
}
</style>
