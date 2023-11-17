<template>
  <v-list-item>
    <v-list-item-action class="self-center">
      <img
        :src="'http://launcher/icons/forge'"
        width="40"
      >
    </v-list-item-action>
    <v-list-item-content>
      <v-list-item-title>
        {{
          t('forgeVersion.name')
        }}
      </v-list-item-title>
      <v-list-item-subtitle>
        <a
          target="browser"
          href="https://github.com/MinecraftForge/MinecraftForge"
        >https://github.com/MinecraftForge/MinecraftForge</a>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <VersionMenu
        :is-clearable="true"
        :items="forgeItems"
        :clear-text="t('forgeVersion.disable')"
        :has-snapshot="true"
        :snapshot.sync="canShowBuggy"
        :snapshot-tooltip="t('fabricVersion.showSnapshot')"
        :refreshing="refreshingForge"
        @select="emit('input', $event)"
      >
        <template #default="{ on }">
          <v-text-field
            :value="value"
            outlined
            filled
            dense
            append-icon="arrow_drop_down"
            :placeholder="t('forgeVersion.disable')"
            :empty-text="t('forgeVersion.empty', { version: minecraft })"
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
import { useForgeVersionList } from '@/composables/versionList'
import { LocalVersionHeader } from '@xmcl/runtime-api'
import VersionMenu from './VersionMenu.vue'

const props = defineProps<{
  minecraft: string
  versions: LocalVersionHeader[]
  value?: string
}>()
const { items: forgeItems, canShowBuggy, recommendedOnly, refresh: refreshForge, refreshing: refreshingForge } = useForgeVersionList(computed(() => props.minecraft), computed(() => props.value ?? ''), computed(() => props.versions))
const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
