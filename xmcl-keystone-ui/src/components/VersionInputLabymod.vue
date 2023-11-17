<template>
  <v-list-item>
    <v-list-item-action class="self-center">
      <img
        :src="'http://launcher/icons/labyMod'"
        width="40px"
      >
    </v-list-item-action>
    <v-list-item-content>
      <v-list-item-title>LabyMod</v-list-item-title>
      <v-list-item-subtitle>
        <a
          target="browser"
          href="https://www.labymod.net"
        >https://www.labymod.net</a>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <VersionMenu
        :is-clearable="true"
        :items="labyModItems"
        :clear-text="t('labyMod.disable')"
        :empty-text="t('labyMod.empty', { version: minecraft })"
        :refreshing="refreshingLabyMod"
        @select="emit('input', $event)"
      >
        <template #default="{ on }">
          <v-text-field
            :value="value"
            outlined
            filled
            dense
            hide-details
            :placeholder="t('labyMod.disable')"
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
import { useLabyModVersionList } from '@/composables/versionList'
import { LocalVersionHeader } from '@xmcl/runtime-api'
import VersionMenu from './VersionMenu.vue'

const props = defineProps<{
  minecraft: string
  versions: LocalVersionHeader[]
  value?: string
}>()

const { items: labyModItems, refreshing: refreshingLabyMod, refresh: refershLabyMod } = useLabyModVersionList(
  computed(() => props.minecraft),
  computed(() => props.value ?? ''),
  computed(() => props.versions),
)
const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
