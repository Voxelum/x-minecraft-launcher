<template>
  <v-tab-item class="local-version-list h-full flex-col gap-4 overflow-auto overflow-x-hidden py-0">
    <v-list
      v-if="versions.length !== 0"
      class=" flex h-full flex-col overflow-auto bg-transparent pt-0"
    >
      <v-list-item class="flex justify-end">
        <v-select
          v-model="data.filteredMinecraft"
          label="Minecraft"
          class="max-w-40 flex-shrink flex-grow-0"
          hide-details
          flat
          :items="minecraftVersions"
          clearable
        />
      </v-list-item>
      <v-virtual-scroll
        id="left-pane"
        :bench="2"
        class="visible-scroll ml-2 h-full max-h-full overflow-auto"
        :items="versions"
        :item-height="50"
      >
        <template #default="{ item }">
          <LocalVersionItem
            :key="item.id"
            :item="item"
            :open-version-dir="openVersionDir"
            :start-reinstall="startReinstall"
            :start-delete="startDelete"
          />
        </template>
      </v-virtual-scroll>
      <v-dialog
        v-model="data.deletingVersion"
        max-width="290"
      >
        <v-card>
          <v-card-title class="headline">
            {{ t('localVersion.delete') }}
          </v-card-title>
          <v-card-text>{{ t('localVersion.deleteDescription') }}</v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              text
              @click="cancelDeleting()"
            >
              {{ t('no') }}
            </v-btn>
            <v-btn
              color="error en-1"
              text
              @click="confirmDeleting()"
            >
              {{ t('yes') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-dialog
        v-model="data.reinstallVersion"
        max-width="390"
      >
        <v-card>
          <v-card-title
            class="headline"
          >
            {{ t('localVersion.reinstallTitle', { version: data.reinstallVersionId }) }}
          </v-card-title>
          <v-card-text>{{ t('localVersion.reinstallDescription') }}</v-card-text>
          <v-card-actions>
            <v-spacer />
            <v-btn
              text
              @click="cancelReinstall()"
            >
              {{ t('no') }}
            </v-btn>
            <v-btn
              color="orange en-1"
              text
              @click="confirmReinstall()"
            >
              <v-icon left>
                build
              </v-icon>
              {{ t('yes') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </v-list>
    <v-container
      v-else
      fill-height
    >
      <v-layout
        align-center
        justify-center
        row
        fill-height
      >
        <v-flex
          shrink
          tag="h1"
          class="white--text gap-3"
        >
          <v-btn
            large
            color="primary"
            :loading="refreshing"
            @click="browseVersionsFolder"
          >
            <v-icon left>
              folder
            </v-icon>
            {{ t('localVersion.empty') }}
          </v-btn>
          <v-btn
            large
            color="primary"
            :loading="refreshing"
            @click="refresh"
          >
            {{ t('localVersion.refresh') }}
          </v-btn>
        </v-flex>
      </v-layout>
    </v-container>
  </v-tab-item>
</template>

<script lang=ts setup>
import { InstallServiceKey, LocalVersionHeader, versionCompare, VersionServiceKey } from '@xmcl/runtime-api'
import { useFilterCombobox, useRefreshable, useService } from '@/composables'
import { usePresence } from '@/composables/presence'
import { injection } from '@/util/inject'
import { kLocalVersions } from '@/composables/versionLocal'
import LocalVersionItem from '@/components/LocalVersionItem.vue'

const data = reactive({
  deletingVersion: false,
  deletingVersionId: '',

  reinstallVersion: false,
  reinstallVersionId: '',

  filteredMinecraft: '',
})
const { reinstall } = useService(InstallServiceKey)
const { versions: localVersions } = injection(kLocalVersions)
const { deleteVersion, showVersionsDirectory, showVersionDirectory, refreshVersions } = useService(VersionServiceKey)
const minecraftVersions = computed(() => [...new Set(localVersions.value.map(v => v.minecraft))].sort(versionCompare).reverse())
const { t } = useI18n()
function getFilterOptions(item: LocalVersionHeader) {
  return [
    { label: '$vuetify.icons.minecraft', value: item.minecraft, color: 'lime' },
  ]
}
const filterOptions = computed(() => localVersions.value.map(getFilterOptions).reduce((a, b) => [...a, ...b], []))
const { filter } = useFilterCombobox(filterOptions, getFilterOptions, (v) => `${v.id}`)
const versions = computed(() => filter(localVersions.value))

function browseVersionsFolder() {
  showVersionsDirectory()
}
function openVersionDir(v: LocalVersionHeader) {
  showVersionDirectory(v.id)
}
function startDelete(v: LocalVersionHeader) {
  data.deletingVersion = true
  data.deletingVersionId = v.id
}
function startReinstall(v: LocalVersionHeader) {
  data.reinstallVersion = true
  data.reinstallVersionId = v.id
}
function confirmDeleting() {
  deleteVersion(data.deletingVersionId)
  data.deletingVersion = false
  data.deletingVersionId = ''
}
function confirmReinstall() {
  reinstall(data.reinstallVersionId)
  data.reinstallVersion = false
  data.reinstallVersionId = ''
}
function cancelDeleting() {
  data.deletingVersion = false
  data.deletingVersionId = ''
}
function cancelReinstall() {
  data.reinstallVersion = false
  data.reinstallVersionId = ''
}
const { refresh, refreshing } = useRefreshable(async () => {
  await refreshVersions()
})

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
