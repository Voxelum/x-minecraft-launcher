<template>
  <div class="flex flex-col">
    <div class="relative flex items-center pr-4">
      <v-btn
        text
        @click="$emit('back')"
      >
        <v-icon small>
          arrow_back
        </v-icon>
      </v-btn>
    </div>
    <div class="m-8 flex flex-col gap-6 text-left">
      <div
        v-for="(a, i) in items"
        :key="i"
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-black/20 shadow-sm p-4 flex flex-col gap-4"
      >
        <div class="flex gap-3 flex-row items-center">
          <v-text-field
            v-if="a.new"
            v-model="a.url"
            autofocus
            :readonly="!a.new"
            outlined
            prepend-inner-icon="link"
            hide-details
            :label="t('userService.baseUrlHint')"
            class="flex-1"
          />
          <div
            v-else-if="resolvePreview(a.url)"
            class="flex-grow rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-3 py-2 text-xs text-gray-600 dark:text-gray-300"
          >
            <div class="uppercase tracking-wide text-[11px] text-gray-400 dark:text-gray-500">{{ t('userService.baseUrlHint') }}</div>
            <div class="font-mono break-all text-sm">{{ resolvePreview(a.url) }}</div>
          </div>
          <v-btn
            v-if="a.new"
            icon
            @click="save(a)"
          >
            <v-icon>add</v-icon>
          </v-btn>
          <v-btn
            v-else
            color="error"
            icon
            @click="remove(a)"
          >
            <v-icon>delete</v-icon>
          </v-btn>
        </div>

        <div class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-white/5 px-4 py-3">
          <template v-if="a.authlibInjector">
            <div class="text-sm font-medium text-gray-700 dark:text-gray-100 flex items-center gap-2">
              <img
                v-if="a.favicon"
                :src="a.favicon"
                alt="favicon"
                class="h-5 w-5 rounded-sm"
              >
              {{ t('userService.authlibInjectorMetadata') }}
            </div>
            <div class="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-200 md:grid-cols-2">
              <div>
                <div class="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ t('userService.server') }}</div>
                <div class="font-mono">{{ a.authlibInjector.meta?.serverName || '-' }}</div>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ t('userService.implementation') }}</div>
                <div class="font-mono">{{ a.authlibInjector.meta?.implementationName || '-' }}</div>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ t('userService.version') }}</div>
                <div class="font-mono">{{ a.authlibInjector.meta?.implementationVersion || '-' }}</div>
              </div>
              <div v-if="a.authlibInjector.skinDomains?.length">
                <div class="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ t('userService.skinDomains') }}</div>
                <div class="font-mono break-words flex flex-wrap gap-1">
                  <span
                    v-for="(domain, idx) in getVisibleSkinDomains(a.authlibInjector.skinDomains)"
                    :key="domain + idx"
                    class="inline-flex items-center rounded bg-white/70 dark:bg-white/10 px-2 py-0.5 text-xs text-gray-700 dark:text-gray-100"
                  >
                    {{ domain }}
                  </span>
                  <span
                    v-if="getHiddenSkinDomains(a.authlibInjector.skinDomains).length"
                    class="inline-flex items-center rounded bg-white/30 dark:bg-black/30 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-200 cursor-help"
                    v-shared-tooltip="() => getHiddenSkinDomains(a.authlibInjector.skinDomains).join('\n')"
                  >
                    +{{ getHiddenSkinDomains(a.authlibInjector.skinDomains).length }}
                  </span>
                </div>
              </div>
            </div>
            <div class="mt-3 grid gap-2 text-sm text-gray-600 dark:text-gray-200 md:grid-cols-2">
              <div>
                <div class="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ t('userService.homepage') }}</div>
                <a
                  v-if="a.authlibInjector.meta?.links?.homepage"
                  :href="a.authlibInjector.meta.links.homepage"
                  target="_blank"
                  class="underline break-all"
                >
                  {{ a.authlibInjector.meta.links.homepage }}
                </a>
                <span v-else>-</span>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ t('userService.register') }}</div>
                <a
                  v-if="a.authlibInjector.meta?.links?.register"
                  :href="a.authlibInjector.meta.links.register"
                  target="_blank"
                  class="underline break-all"
                >
                  {{ a.authlibInjector.meta.links.register }}
                </a>
                <span v-else>-</span>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="text-sm text-gray-500 dark:text-gray-300">
              {{ t('userService.title')  }}
            </div>
          </template>
        </div>
      </div>
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

const items: Ref<(AuthorityItem)[]> = ref([])
watch(services, (s) => {
  if (!s) return
  items.value = s.filter(api => api.kind === 'yggdrasil').map(api => ({
    url: api.authority,
    new: false,
    isConnect: false,
    authlibInjector: api.authlibInjector,
    favicon: api.favicon,
    flow: api.flow,
  }))
  // When entering the view for editing (e.g. from add button), automatically add a new editable item
  if (items.value.every(v => !v.new)) {
    items.value.unshift({ url: '', new: true })
  }
}, { immediate: true })

const { addYggdrasilService, removeYggdrasilService } = useService(UserServiceKey)
const { t } = useI18n()

const addNew = () => {
  if (items.value?.every(v => !v.new)) {
    items.value.push({ url: '', new: true })
  }
}

const isValidUrl = (s: string) => {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch (e) { return false }
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
const getVisibleSkinDomains = (domains?: string[]) => (domains || []).slice(0, MAX_SKIN_DOMAINS_DISPLAY)
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
