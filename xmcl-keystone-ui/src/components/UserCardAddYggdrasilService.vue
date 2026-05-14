<template>
  <div class="flex flex-col overflow-hidden w-full h-full relative">
    <div
      class="relative flex items-center px-4 pt-2 z-10 pointer-events-none pb-2 border-b"
      style="border-color: rgba(var(--v-theme-on-surface), 0.08)"
    >
      <v-btn
        icon="arrow_back"
        variant="tonal"
        class="hover:scale-105 active:scale-95 transition-all pointer-events-auto"
        @click="$emit('back')"
      />
      <span
        class="ml-4 text-xl font-bold tracking-tight"
        style="color: rgba(var(--v-theme-on-surface), 0.9)"
        >{{ t('userService.title') }}</span
      >
    </div>
    <div class="flex-1 min-h-0 p-6 flex flex-col gap-6 text-left overflow-y-auto invisible-scroll">
      <v-card
        v-for="(a, i) in items"
        :key="i"
        variant="flat"
        class="overflow-hidden border backdrop-blur-md rounded-[2rem] transition-all hover:shadow-lg flex-shrink-0"
      >
        <div class="flex gap-4 flex-col md:flex-row items-center px-6 pt-6 pb-2">
          <v-text-field
            v-if="a.new"
            v-model="a.url"
            autofocus
            :readonly="!a.new"
            variant="outlined"
            prepend-inner-icon="link"
            hide-details
            density="comfortable"
            rounded="lg"
            :label="t('userService.baseUrlHint')"
            class="flex-1 w-full"
          />
          <div
            v-else-if="resolvePreview(a.url)"
            class="flex-grow rounded-xl border border-dashed px-4 py-3 text-sm w-full md:w-auto"
            style="
              border-color: rgba(var(--v-theme-on-surface), 0.2);
              background: rgba(var(--v-theme-on-surface), 0.02);
            "
          >
            <div class="text-[11px] uppercase tracking-wide opacity-60 font-bold mb-1">
              {{ t('userService.baseUrlHint') }}
            </div>
            <div class="font-mono break-all font-medium opacity-90">
              {{ resolvePreview(a.url) }}
            </div>
          </div>
          <div class="flex items-center gap-2 self-end md:self-center">
            <v-btn
              v-if="a.new"
              icon="add"
              variant="tonal"
              density="comfortable"
              color="primary"
              class="hover:scale-110 transition-transform"
              @click="save(a)"
            />
            <v-btn
              v-else
              icon="delete"
              variant="tonal"
              density="comfortable"
              color="error"
              class="hover:scale-110 transition-transform"
              @click="remove(a)"
            />
          </div>
        </div>

        <v-card
          variant="tonal"
          rounded="xl"
          class="mx-6 my-4 px-5 py-4"
          style="background: rgba(var(--v-theme-on-surface), 0.03)"
        >
          <template v-if="a.authlibInjector">
            <div class="text-sm font-bold flex items-center gap-3 mb-4 opacity-90">
              <img
                v-if="a.favicon"
                :src="a.favicon"
                alt="favicon"
                class="h-6 w-6 rounded shadow-sm"
              />
              <v-icon v-else size="24" class="opacity-50">api</v-icon>
              {{ t('userService.authlibInjectorMetadata') }}
            </div>
            <div class="grid gap-4 text-sm md:grid-cols-2">
              <div
                class="p-3 rounded-lg border"
                style="
                  background: rgba(var(--v-theme-surface), 0.4);
                  border-color: rgba(var(--v-theme-on-surface), 0.05);
                "
              >
                <div class="text-[10px] uppercase tracking-wider opacity-60 font-bold mb-1">
                  {{ t('userService.server') }}
                </div>
                <div class="font-mono font-medium">
                  {{ a.authlibInjector.meta?.serverName || '-' }}
                </div>
              </div>
              <div
                class="p-3 rounded-lg border"
                style="
                  background: rgba(var(--v-theme-surface), 0.4);
                  border-color: rgba(var(--v-theme-on-surface), 0.05);
                "
              >
                <div class="text-[10px] uppercase tracking-wider opacity-60 font-bold mb-1">
                  {{ t('userService.implementation') }}
                </div>
                <div class="font-mono font-medium">
                  {{ a.authlibInjector.meta?.implementationName || '-' }}
                </div>
              </div>
              <div
                class="p-3 rounded-lg border"
                style="
                  background: rgba(var(--v-theme-surface), 0.4);
                  border-color: rgba(var(--v-theme-on-surface), 0.05);
                "
              >
                <div class="text-[10px] uppercase tracking-wider opacity-60 font-bold mb-1">
                  {{ t('userService.version') }}
                </div>
                <div class="font-mono font-medium">
                  {{ a.authlibInjector.meta?.implementationVersion || '-' }}
                </div>
              </div>
              <div
                class="p-3 rounded-lg border"
                style="
                  background: rgba(var(--v-theme-surface), 0.4);
                  border-color: rgba(var(--v-theme-on-surface), 0.05);
                "
                v-if="a.authlibInjector.skinDomains?.length"
              >
                <div class="text-[10px] uppercase tracking-wider opacity-60 font-bold mb-1">
                  {{ t('userService.skinDomains') }}
                </div>
                <div class="font-mono break-words flex flex-wrap gap-1 mt-1">
                  <v-chip
                    v-for="(domain, idx) in getVisibleSkinDomains(a.authlibInjector.skinDomains)"
                    :key="domain + idx"
                    size="x-small"
                    variant="flat"
                    color="primary"
                    class="font-bold tracking-wide"
                  >
                    {{ domain }}
                  </v-chip>
                  <v-chip
                    v-if="getHiddenSkinDomains(a.authlibInjector.skinDomains).length"
                    v-shared-tooltip="
                      () => getHiddenSkinDomains(a.authlibInjector.skinDomains).join('\n')
                    "
                    size="x-small"
                    variant="tonal"
                    color="primary"
                    class="font-bold"
                  >
                    +{{ getHiddenSkinDomains(a.authlibInjector.skinDomains).length }}
                  </v-chip>
                </div>
              </div>
            </div>

            <div class="mt-4 grid gap-4 text-sm md:grid-cols-2">
              <div
                class="p-3 rounded-lg border"
                style="
                  background: rgba(var(--v-theme-surface), 0.4);
                  border-color: rgba(var(--v-theme-on-surface), 0.05);
                "
              >
                <div
                  class="text-[10px] uppercase tracking-wider opacity-60 font-bold mb-1 flex items-center gap-1"
                >
                  <v-icon size="12">home</v-icon> {{ t('userService.homepage') }}
                </div>
                <a
                  v-if="a.authlibInjector.meta?.links?.homepage"
                  :href="a.authlibInjector.meta.links.homepage"
                  target="browser"
                  class="text-primary hover:text-primary-light hover:underline break-all transition-colors font-medium"
                >
                  {{ a.authlibInjector.meta.links.homepage }}
                </a>
                <span v-else class="opacity-40">-</span>
              </div>
              <div
                class="p-3 rounded-lg border"
                style="
                  background: rgba(var(--v-theme-surface), 0.4);
                  border-color: rgba(var(--v-theme-on-surface), 0.05);
                "
              >
                <div
                  class="text-[10px] uppercase tracking-wider opacity-60 font-bold mb-1 flex items-center gap-1"
                >
                  <v-icon size="12">person_add</v-icon> {{ t('userService.register') }}
                </div>
                <a
                  v-if="a.authlibInjector.meta?.links?.register"
                  :href="a.authlibInjector.meta.links.register"
                  target="browser"
                  class="text-primary hover:text-primary-light hover:underline break-all transition-colors font-medium"
                >
                  {{ a.authlibInjector.meta.links.register }}
                </a>
                <span v-else class="opacity-40">-</span>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="text-sm font-medium opacity-60 flex items-center justify-center gap-2 py-2">
              <v-icon>info</v-icon>
              {{ t('userService.title') }}
            </div>
          </template>
        </v-card>
      </v-card>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useService } from '@/composables'
import { kSupportedAuthorityMetadata } from '@/composables/yggrasil'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { UserServiceKey } from '@xmcl/runtime-api'
import { Ref, ref, watch } from 'vue'

defineEmits<{
  (e: 'back'): void
}>()

const { data: services, mutate } = injection(kSupportedAuthorityMetadata)

type AuthorityItem = {
  new?: boolean
  url: string
  isConnect?: boolean
  authlibInjector?: any
  favicon?: string
  flow?: string[]
}

const items: Ref<AuthorityItem[]> = ref([])
watch(
  services,
  (s) => {
    if (!s) return
    items.value = s
      .filter((api) => api.kind === 'yggdrasil')
      .map((api) => ({
        url: api.authority,
        new: false,
        isConnect: false,
        authlibInjector: api.authlibInjector,
        favicon: api.favicon,
        flow: api.flow,
      }))
    // When entering the view for editing (e.g. from add button), automatically add a new editable item
    if (items.value.every((v) => !v.new)) {
      items.value.unshift({ url: '', new: true })
    }
  },
  { immediate: true },
)

const { addYggdrasilService, removeYggdrasilService } = useService(UserServiceKey)
const { t } = useI18n()

const addNew = () => {
  if (items.value?.every((v) => !v.new)) {
    items.value.push({ url: '', new: true })
  }
}

const isValidUrl = (s: string) => {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch (e) {
    return false
  }
}

const normalizeInputToUrl = (input: string) => {
  const s = (input || '').trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    const path = u.pathname.replace(/\/+$/, '')
    if (path.endsWith('/api/yggdrasil')) return u.toString()
    if (u.pathname === '' || u.pathname === '/') {
      u.pathname = '/api/yggdrasil'
      return u.toString()
    }
    return u.toString()
  } catch (e) {
    try {
      const u = new URL('https://' + s)
      if (u.pathname === '' || u.pathname === '/') {
        u.pathname = '/api/yggdrasil'
        return u.toString()
      }
      return u.toString()
    } catch (e2) {
      return ''
    }
  }
}

const MAX_SKIN_DOMAINS_DISPLAY = 10
const getVisibleSkinDomains = (domains?: string[]) =>
  (domains || []).slice(0, MAX_SKIN_DOMAINS_DISPLAY)
const getHiddenSkinDomains = (domains?: string[]) => (domains || []).slice(MAX_SKIN_DOMAINS_DISPLAY)

const save = async (api: AuthorityItem) => {
  const url = normalizeInputToUrl(api.url)
  if (!url) return
  await addYggdrasilService(url)
  mutate()
}
const remove = async (api: AuthorityItem) => {
  const url = normalizeInputToUrl(api.url) || api.url
  await removeYggdrasilService(url)
  mutate()
}

const resolvePreview = (v: string) => normalizeInputToUrl(v) || ''
</script>
