<template>
  <v-list-item>
    <v-list-item-action class="self-center">
      <img
        :src="'http://launcher/icons/optifine'"
        width="40px"
      >
    </v-list-item-action>
    <v-list-item-content>
      <v-list-item-title>Optifine</v-list-item-title>
      <v-list-item-subtitle>
        <a
          target="browser"
          href="https://www.optifine.net/home"
        >https://www.optifine.net/home</a>
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <VersionMenu
        :is-clearable="true"
        :items="optifineItems"
        :clear-text="t('optifineVersion.disable')"
        :empty-text="t('optifineVersion.empty', { version: minecraft })"
        :refreshing="refreshingOptifine"
        @select="emit('input', $event)"
      >
        <template #default="{ on }">
          <v-text-field
            :value="value"
            outlined
            filled
            dense
            hide-details
            :placeholder="t('optifineVersion.disable')"
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
import { useOptifineVersionList } from '@/composables/versionList'
import { LocalVersionHeader } from '@xmcl/runtime-api'
import VersionMenu from './VersionMenu.vue'

const props = defineProps<{
  minecraft: string
  forge: string
  versions: LocalVersionHeader[]
  value?: string
}>()

const { items: optifineItems, refreshing: refreshingOptifine } = useOptifineVersionList(
  computed(() => props.minecraft),
  computed(() => props.forge),
  computed(() => props.value ?? ''),
  computed(() => props.versions),
)
const { t } = useI18n()

const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
