<template>
  <div class="flex h-full flex-col overflow-auto">
    <v-list-item class="flex-grow-0 flex-shrink flex-1 flex justify-end">
      <v-checkbox
        v-model="data.recommendedOnly"
        :label="t('forge.recommendedAndLatestOnly')"
      />
      <v-spacer />
      <v-checkbox
        v-model="data.showBuggy"
        :label="t('forge.showBuggy')"
      />
    </v-list-item>
    <v-divider />
    <refreshing-tile v-if="refreshing && versions.length === 0" />
    <v-list
      v-else-if="versions.length !== 0"
      class="h-full flex flex-col overflow-auto flex-grow"
      style="background-color: transparent;"
    >
      <v-list-item
        ripple
        class="flex-grow-0 flex-1 justify-start"
        @click="select({ version: '' })"
      >
        <v-list-item-avatar>
          <v-icon>close</v-icon>
        </v-list-item-avatar>
        {{ t('forge.disable') }}
      </v-list-item>
      <virtual-list
        class="h-full overflow-y-auto"
        :data-sources="versions"
        :data-key="'version'"
        :data-component="ForgeVersionListTile"
        :keep="16"
        :extra-props="{ selected: version, select: select, install: install, statuses }"
      />
    </v-list>
    <Hint
      v-else
      v-ripple
      style="cursor: pointer"
      class="flex-grow"
      icon="refresh"
      :text="t('forge.noVersion', { version: minecraft })"
      @click="refresh"
    />
  </div>
</template>

<script lang=ts setup>
import { ForgeVersion } from '@xmcl/runtime-api'
import Hint from '/@/components/Hint.vue'
import RefreshingTile from '/@/components/RefreshingTile.vue'
import ForgeVersionListTile from './VersionForgeListTile.vue'
import { useForgeVersions } from '../composables/version'
import { useI18n } from '/@/composables'

const props = defineProps<{
  select:(v: {version: string}) => void
  filterText: string
  minecraft: string
  version: string
}>()

const data = reactive({
  recommendedOnly: true,
  showBuggy: false,
})
const { t } = useI18n()
const { statuses, versions: vers, refreshing, refresh, install } = useForgeVersions(computed(() => props.minecraft))
function filterForge(version: ForgeVersion) {
  if (data.recommendedOnly && version.type !== 'recommended' && version.type !== 'latest') { return false }
  if (data.showBuggy && version.type !== 'buggy') { return true }
  return version.version.indexOf(props.filterText) !== -1
}
const versions = computed(() => vers.value.filter(filterForge).sort((a, b) => {
  if (a.date && b.date) {
    // @ts-ignore
    return new Date(b.date) - (new Date(a.date))
  }
  return b.version.localeCompare(a.version)
}).map(v => ({ ...v, status: statuses.value[v.version] })))
watch(versions, () => {
  if (versions.value.length === 0) {
    data.recommendedOnly = false
  }
})
</script>

<style scoped=true>
/* .flex {
  padding: 6px 8px !important;
} */
.subtitle {
  color: grey;
  font-size: 14px;
}
.version-tab {
  max-width: 100px;
  min-width: 100px;
}
</style>
<style>
.v-window__container {
  height: 100%;
}
</style>
