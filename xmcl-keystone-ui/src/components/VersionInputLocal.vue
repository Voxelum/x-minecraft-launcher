<template>
  <v-list-item>
    <v-list-item-action class="self-center">
      <img
        :src="'http://launcher/icons/craftingTable'"
        width="40px"
      >
    </v-list-item-action>
    <v-list-item-content>
      <v-list-item-title>{{ t('localVersion.title', 1) }}</v-list-item-title>
      <v-list-item-subtitle>
        {{ t('localVersion.hint') }}
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <VersionMenu
        :items="localItems"
        :empty-text="t('localVersion.empty')"
        @select="emit('input', $event)"
      >
        <template #default="{ on }">
          <v-text-field
            :value="value"
            outlined
            filled
            dense
            hide-details
            :placeholder="t('localVersion.auto')"
            append-icon="arrow_drop_down"
            persistent-hint
            :readonly="true"
            @click:append="on.click($event);"
            v-on="on"
          />
        </template>
      </VersionMenu>
    </v-list-item-action>
  </v-list-item>
</template>
<script lang="ts" setup>
import { VersionMenuItem } from '@/composables/versionList'
import { LocalVersionHeader } from '@xmcl/runtime-api'
import VersionMenu from './VersionMenu.vue'

const props = defineProps<{
  versions: LocalVersionHeader[]
  value?: string
}>()

const localItems = computed(() => {
  return props.versions.map(ver => {
    const result: VersionMenuItem = {
      name: ver.id,
      tag: ver.minecraft,
    }
    return result
  })
})

const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
