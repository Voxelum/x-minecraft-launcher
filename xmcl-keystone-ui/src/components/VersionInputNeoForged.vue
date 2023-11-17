<template>
  <v-list-item>
    <v-list-item-action class="self-center">
      <img
        :src="'http://launcher/icons/neoForged'"
        width="40"
      >
    </v-list-item-action>
    <v-list-item-content>
      <v-list-item-title>
        {{
          t('neoForgedVersion.name')
        }}
      </v-list-item-title>
      <v-list-item-subtitle>
        <a
          target="browser"
          href="https://github.com/neoforged/NeoForge"
        >https://github.com/neoforged/NeoForge</a>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <VersionMenu
        :is-clearable="true"
        :items="neoForgedItems"
        :clear-text="t('neoForgedVersion.disable')"
        :refreshing="refreshingNeoForged"
        @select="emit('input', $event)"
      >
        <template #default="{ on }">
          <v-text-field
            :value="value"
            outlined
            filled
            dense
            append-icon="arrow_drop_down"
            :placeholder="t('neoForgedVersion.disable')"
            :empty-text="t('neoForgedVersion.empty', { version: minecraft })"
            hide-details
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
import { useNeoForgedVersionList } from '@/composables/versionList'
import { LocalVersionHeader } from '@xmcl/runtime-api'
import VersionMenu from './VersionMenu.vue'

const props = defineProps<{
  minecraft: string
  versions: LocalVersionHeader[]
  value?: string
}>()
const { items: neoForgedItems, refresh: refreshNeoForged, refreshing: refreshingNeoForged } = useNeoForgedVersionList(computed(() => props.minecraft), computed(() => props.value ?? ''), computed(() => props.versions))
const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
