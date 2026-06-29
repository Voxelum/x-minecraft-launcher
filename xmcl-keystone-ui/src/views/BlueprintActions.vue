<template>
  <div
    v-roving-tabindex
    role="toolbar"
    aria-orientation="horizontal"
    :aria-label="t('blueprint.name')"
    class="flex items-center justify-end gap-3"
  >
    <v-btn
      v-shared-tooltip="() => t('blueprint.market')"
      icon
      variant="text"
      large
      :class="{ 'v-btn--active': isRemote }"
      data-testid="blueprint-market-btn"
      @click="toggleMarket"
    >
      <v-icon>storefront</v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip="() => t('blueprint.import')"
      icon
      variant="text"
      large
      data-testid="blueprint-import-btn"
      @click="importBlueprint"
    >
      <v-icon>add</v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip="() => t('blueprint.openFolder')"
      icon
      variant="text"
      large
      @click="showDirectory(path)"
    >
      <v-icon>folder</v-icon>
    </v-btn>
    <v-btn
      v-shared-tooltip="() => t('blueprint.refresh')"
      icon
      variant="text"
      large
      @click="refresh"
    >
      <v-icon>refresh</v-icon>
    </v-btn>
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { useQuery } from '@/composables/query'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { vSharedTooltip } from '@/directives/sharedTooltip'
import { injection } from '@/util/inject'
import { InstanceBlueprintsServiceKey } from '@xmcl/runtime-api'

const { path } = injection(kInstance)
const { showDirectory, install } = useService(InstanceBlueprintsServiceKey)
const { t } = useI18n()

const market = useQuery('source')
const isRemote = computed(() => market.value === 'market')
const selectedId = useQuery('id')
const refreshFlag = useQuery('refresh')

function toggleMarket() {
  selectedId.value = ''
  market.value = isRemote.value ? '' : 'market'
}
function refresh() {
  refreshFlag.value = String(Date.now())
}
async function importBlueprint() {
  const { filePaths, canceled } = await windowController.showOpenDialog({
    title: t('blueprint.import'),
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Blueprint', extensions: ['litematic', 'schem', 'schematic', 'nbt', 'json'] }],
  })
  if (canceled || filePaths.length === 0) return
  await install({ files: filePaths, path: path.value })
}
</script>
