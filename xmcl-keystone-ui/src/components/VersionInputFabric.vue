<template>
  <v-list-item>
    <v-list-item-action class="self-center">
      <img
        :src="'http://launcher/icons/fabric'"
        width="40"
      >
    </v-list-item-action>
    <v-list-item-content>
      <v-list-item-title>Fabric</v-list-item-title>
      <v-list-item-subtitle>
        <a
          target="browser"
          href="https://fabricmc.net/"
        >https://fabricmc.net/</a>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <VersionMenu
        :is-clearable="true"
        :items="fabricItems"
        :clear-text="t('fabricVersion.disable')"
        :has-snapshot="true"
        :empty-text="t('fabricVersion.empty', { version: minecraft })"
        :snapshot.sync="showStableOnly"
        :snapshot-tooltip="t('fabricVersion.showSnapshot')"
        :refreshing="refreshingFabric"
        @select="emit('input', $event)"
      >
        <template #default="{ on }">
          <v-text-field
            :value="value"
            outlined
            filled
            dense
            :placeholder="t('fabricVersion.disable')"
            hide-details
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
import { useFabricVersionList } from '@/composables/versionList'
import { LocalVersionHeader } from '@xmcl/runtime-api'
import VersionMenu from './VersionMenu.vue'

const props = defineProps<{
  minecraft: string
  versions: LocalVersionHeader[]
  value?: string
}>()
const { items: fabricItems, showStableOnly, refreshing: refreshingFabric } = useFabricVersionList(
  computed(() => props.minecraft),
  computed(() => props.value ?? ''),
  computed(() => props.versions),
)
const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
