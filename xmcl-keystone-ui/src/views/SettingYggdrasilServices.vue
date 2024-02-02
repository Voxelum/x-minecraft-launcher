<template>
  <div>
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
    <v-list
      color="transparent"
      hover
    >
      <v-list-item
        v-for="(a, i) of items || []"
        :key="i"
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
          />
        </v-list-item-content>
        <v-list-item-action>
          <v-btn
            v-if="a.new"
            icon
            text
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
    </v-list>
  </div>
</template>
<script setup lang="ts">
import SettingHeader from '@/components/SettingHeader.vue'
import { useService } from '@/composables'
import { kYggdrasilServices } from '@/composables/yggrasil'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { YggdrasilApi, YggdrasilServiceKey } from '@xmcl/runtime-api'
import { Ref } from 'vue'

const { data: services, mutate } = injection(kYggdrasilServices)
const items: Ref<(YggdrasilApi &{ new?: boolean })[]> = ref([])
watch(services, (s) => {
  if (!s) return
  items.value = s.map(api => ({ ...api, new: false }))
}, { immediate: true })
const { addYggdrasilService, removeYggdrasilService } = useService(YggdrasilServiceKey)
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

const save = async (api: YggdrasilApi) => {
  await addYggdrasilService(api.url)
  mutate()
}
const remove = async (api: YggdrasilApi) => {
  await removeYggdrasilService(api.url)
  mutate()
}
</script>
