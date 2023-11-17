<template>
  <v-list-item>
    <v-list-item-action class="self-center">
      <img
        :src="'http://launcher/icons/minecraft'"
        width="40"
      >
    </v-list-item-action>
    <v-list-item-content>
      <v-list-item-title>
        {{
          t('minecraftVersion.name')
        }}
      </v-list-item-title>
      <v-list-item-subtitle>
        {{
          t('instance.versionHint')
        }}
      </v-list-item-subtitle>
    </v-list-item-content>
    <v-list-item-action>
      <VersionMenu
        :is-clearable="false"
        :items="minecraftItems"
        :has-snapshot="true"
        :snapshot.sync="showAlpha"
        :snapshot-tooltip="t('fabricVersion.showSnapshot')"
        :refreshing="refreshingMinecraft"
        @select="emit('input', $event)"
      >
        <template #default="{ on }">
          <v-text-field
            :value="value"
            outlined
            filled
            dense
            append-icon="arrow_drop_down"
            persistent-hint
            hide-details
            :readonly="true"
            @input="emit('input', $event)"
            @click:append="on.click($event);onClick();"
            v-on="on"
          />
        </template>
      </VersionMenu>
    </v-list-item-action>
  </v-list-item>
</template>
<script lang="ts" setup>
import { useMinecraftVersionList } from '@/composables/versionList'
import { LocalVersionHeader } from '@xmcl/runtime-api'
import VersionMenu from './VersionMenu.vue'

const props = defineProps<{
  versions: LocalVersionHeader[]
  value: string
}>()
const { items: minecraftItems, showAlpha, refreshing: refreshingMinecraft, release, mutate } = useMinecraftVersionList(computed(() => props.value), computed(() => props.versions))
const { t } = useI18n()
const onClick = () => {
  mutate()
  console.log('mutate')
}
const emit = defineEmits<{
  (event: 'input', value: string): void
}>()
</script>
