<template>
  <div>
    <v-subheader>
      {{ t('userService.title') }}

      <v-spacer />
      <v-tooltip left>
        <template #activator="{ on }">
          <v-btn
            icon
            @click="addNew"
            v-on="on"
          >
            <v-icon>add</v-icon>
          </v-btn>
        </template>
        {{ t("userService.add") }}
      </v-tooltip>
    </v-subheader>
    <v-list
      color="transparent"
      hover
    >
      <v-list-item
        v-for="(a, i) of container"
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
import { useService } from '@/composables'
import { UserServiceKey, YggdrasilApi } from '@xmcl/runtime-api'

const { state, addYggdrasilAccountSystem, removeYggdrasilAccountSystem } = useService(UserServiceKey)
const services = computed(() => state.yggdrasilServices)
const container = ref([...services.value.map(s => ({ ...s }))] as (YggdrasilApi & { new?: boolean })[])
watch(services, (newVal) => {
  container.value = [...newVal.map(s => ({ ...s }))]
})
const { t } = useI18n()

const addNew = () => {
  if (container.value.every(v => !v.new)) {
    container.value.push({ url: '', new: true })
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

const save = (api: YggdrasilApi) => {
  addYggdrasilAccountSystem(api.url)
}
const remove = (api: YggdrasilApi) => {
  removeYggdrasilAccountSystem(api.url)
}
</script>
