<template>
  <SettingHeader>
    <div class="flex">
      🔑 {{ t('userService.title') }}

      <v-spacer />
      <v-btn
        v-shared-tooltip.left="_ => t('userService.add')"
        icon
        @click="addNew"
      >
        <v-icon>add</v-icon>
      </v-btn>
    </div>
  </SettingHeader>
  <v-list-item
    v-for="(a, i) of items || []"
    :key="i"
  >
    <v-text-field
      v-model="a.url"
      :readonly="!a.new"
      variant="filled"
      :rules="urlsRules"
      density="compact"
      hide-details
      :placeholder="t('userService.baseUrlHint')"
    />
        
    <template #append>
      <v-btn
        v-if="a.new"
        icon
        variant="text"
        @click="save(a)"
      >
        <v-icon>save</v-icon>
      </v-btn>
      <v-btn
        v-else
        color="error"
        icon
        variant="text"
        @click="remove(a)"
      >
        <v-icon>delete</v-icon>
      </v-btn>
    </template>
  </v-list-item>
</template>
<script setup lang="ts">
import SettingHeader from '@/components/SettingHeader.vue'
import { useService } from '@/composables'
import { kSupportedAuthorityMetadata } from '@/composables/yggrasil'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { UserServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'

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
