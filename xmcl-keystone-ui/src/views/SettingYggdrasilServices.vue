<template>
  <v-card class="mb-4" elevation="2" color="transparent">
    <v-card-title class="text-subtitle-1 pb-2">
      <v-icon left color="primary" small>vpn_key</v-icon>
      {{ t('userService.title') }}
      <v-spacer />
      <v-btn
        v-shared-tooltip.left="_ => t('userService.add')"
        icon
        small
        @click="addNew"
      >
        <v-icon>add</v-icon>
      </v-btn>
    </v-card-title>
    
    <v-card-text class="pa-4">
      <v-list class="transparent-list">
        <v-slide-y-transition group>
          <v-list-item
            v-for="(a, i) of items || []"
            :key="i"
            class="mb-2 rounded-lg"
          >
            <v-list-item-content>
              <v-text-field
                v-model="a.url"
                :readonly="!a.new"
                filled
                :rules="urlsRules"
                dense
                hide-details
                :placeholder="t('userService.baseUrlHint')"
                prepend-inner-icon="link"
                class="rounded-lg"
              />
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                v-if="a.new"
                icon
                text
                color="primary"
                @click="save(a)"
              >
                <v-icon>save</v-icon>
              </v-btn>
              <v-btn
                v-else
                color="error"
                icon
                text
                @click="remove(a)"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-slide-y-transition>
        
        <div v-if="!items || items.length === 0" class="text-center grey--text py-4">
          {{ t('userService.noServices') || 'No third-party services configured' }}
        </div>
      </v-list>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch, Ref } from 'vue'
import { useI18n } from 'vue-i18n-bridge'
import { useService } from '@/composables'
import { kSupportedAuthorityMetadata } from '@/composables/yggrasil'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { UserServiceKey } from '@xmcl/runtime-api'

type AuthorityItem = {
  new?: boolean
  url: string
}
const { data: services, mutate } = injection(kSupportedAuthorityMetadata)

const items: Ref<(AuthorityItem)[]> = ref([])
watch(services, (s) => {
  if (!s) return
  items.value = s.filter(api => api.kind === 'yggdrasil').map(api => ({ url: api.authority, new: false, isConnect: false }))
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
    // eslint-disable-next-line no-new
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch (e) { return false }
}
const urlsRules = [
  (v: string | undefined) => v && isValidUrl(v),
]

const save = async (api: AuthorityItem) => {
  await addYggdrasilService(api.url)
  mutate()
}
const remove = async (api: AuthorityItem) => {
  await removeYggdrasilService(api.url)
  mutate()
}
</script>

<style scoped>
:deep(.transparent-list) {
  background: transparent !important;
}

.v-card {
  border-radius: 12px;
  transition: all 0.2s ease;
}

.v-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style>
