<template>
  <div class="local-version-list h-full flex-col gap-4 overflow-auto overflow-x-hidden py-0">
    <v-data-table
      :items="items"
      :headers="headers"
      :loading="refreshing"
      :items-per-page="10"
    >
      <template #item.id="{ item }">
        <v-icon
          large
          left
        >
          {{ item.icon }}
        </v-icon>
        {{ item.id }}
      </template>
      <template #item.actions="{ item }">
        <v-btn
          icon
          @click="showVersionDirectory(item.id)"
        >
          <v-icon>
            folder
          </v-icon>
        </v-btn>
        <v-btn
          icon
          @click="reinstallDialog.show(item.id)"
        >
          <v-icon>
            build
          </v-icon>
        </v-btn>
        <v-btn
          icon
          @click="deleteDialog.show(item.id)"
        >
          <v-icon color="red">
            delete
          </v-icon>
        </v-btn>
      </template>
      <template #footer.prepend>
        <div class="ml-2 flex items-center gap-2">
          <v-btn
            icon
            :loading="refreshing"
            @click="browseVersionsFolder"
          >
            <v-icon>
              folder
            </v-icon>
          </v-btn>
          <v-btn
            v-shared-tooltip="_ => t('localVersion.refresh')"
            icon
            :loading="refreshing"
            @click="refresh"
          >
            <v-icon>
              refresh
            </v-icon>
          </v-btn>
          <v-select
            v-model="data.filteredMinecraft"
            label="Minecraft"
            class="max-w-40 flex-shrink flex-grow-0 items-center"
            hide-details
            flat
            solo
            prepend-icon="filter_alt"
            :items="minecraftVersions"
            clearable
          />
        </div>
      </template>
    </v-data-table>

    <SimpleDialog
      v-model="deleteDialogModel"
      :title="t('localVersion.delete')"
      :width="290"
      :confirm-icon="'delete'"
      :color="'error en-1'"
      :confirm="t('yes')"
      @cancel="deleteDialog.cancel"
      @confirm="deleteDialog.confirm"
    >
      {{ t('localVersion.deleteDescription') }}
    </SimpleDialog>
    <SimpleDialog
      v-model="reinstallDialogModel"
      :width="390"
      :title="t('localVersion.reinstallTitle', { version: reinstallDialog.target.value })"
      :confirm-icon="'build'"
      :color="'orange en-1'"
      :confirm="t('yes')"
      @cancel="reinstallDialog.cancel"
      @confirm="reinstallDialog.confirm"
    >
      {{ t('localVersion.reinstallDescription') }}
    </SimpleDialog>
  </div>
</template>

<script lang=ts setup>
import { InstallServiceKey, VersionHeader, versionCompare, VersionServiceKey } from '@xmcl/runtime-api'
import { useFilterCombobox, useRefreshable, useService } from '@/composables'
import { usePresence } from '@/composables/presence'
import { injection } from '@/util/inject'
import { kLocalVersions } from '@/composables/versionLocal'
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useSimpleDialog } from '@/composables/dialog'
import { vSharedTooltip } from '@/directives/sharedTooltip'

const data = reactive({
  filteredMinecraft: '',
})

const reinstallDialog = useSimpleDialog<string>((v) => {
  if (!v) return
  reinstall(v)
})
const reinstallDialogModel = reinstallDialog.model

const deleteDialog = useSimpleDialog<string>((v) => {
  if (!v) return
  deleteVersion(v)
})
const deleteDialogModel = deleteDialog.model

const headers = computed(() => [{
  text: t('version.name'),
  sortable: true,
  value: 'id',
}, {
  text: 'Minecraft',
  sortable: true,
  value: 'minecraft',
}, {
  text: t('modrinth.modLoaders.name'),
  sortable: false,
  value: 'loader',
}, {
  value: 'actions',
  sortable: false,
}])

const getIcon = (item: VersionHeader) => {
  if (item.forge) return '$vuetify.icons.forge'
  if (item.fabric) return '$vuetify.icons.fabric'
  if (item.quilt) return '$vuetify.icons.quilt'
  if (item.optifine) return '$vuetify.icons.optifine'
  if (item.neoForged) return '$vuetify.icons.neoForged'
  return '$vuetify.icons.minecraft'
}

const items = computed(() => localVersions.value.filter(v => !data.filteredMinecraft || v.minecraft === data.filteredMinecraft).map(v => ({
  id: v.id,
  minecraft: v.minecraft,
  icon: getIcon(v),
  loader: [v.forge, v.fabric, v.neoForged, v.optifine, v.quilt].filter(v => !!v),
  header: v,
})))

const { reinstall } = useService(InstallServiceKey)
const { versions: localVersions } = injection(kLocalVersions)
const { deleteVersion, showVersionsDirectory, showVersionDirectory, refreshVersions } = useService(VersionServiceKey)
const minecraftVersions = computed(() => [...new Set(localVersions.value.map(v => v.minecraft))].sort(versionCompare).reverse())
const { t } = useI18n()
function getFilterOptions(item: VersionHeader) {
  return [
    { label: '$vuetify.icons.minecraft', value: item.minecraft, color: 'lime' },
  ]
}
const filterOptions = computed(() => localVersions.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))

function browseVersionsFolder() {
  showVersionsDirectory()
}
function openVersionDir(v: VersionHeader) {
  showVersionDirectory(v.id)
}
const { refresh, refreshing } = useRefreshable(refreshVersions)

usePresence(computed(() => t('presence.version')))
</script>

<style>
.local-version-list
  .v-text-field>.v-input__control>.v-input__slot:before {
  border: none;
}
</style>

<style scoped>
.dark .selected {
  background: rgba(234, 233, 255, 0.2) !important;
}

.selected {
  background: rgba(0, 0, 0, 0.2) !important;
}

</style>
