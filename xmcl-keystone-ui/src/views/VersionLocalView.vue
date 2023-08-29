<template>
  <div class="visible-scroll h-full">
    <v-list
      v-if="versions.length !== 0"
      class="local-version-list flex h-full flex-col overflow-auto"
      style="background: transparent"
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
      <v-divider />
      <div
        class="flex h-full flex-shrink flex-grow-0 flex-col overflow-auto"
      >
        <template v-for="(item) in versions">
          <v-list-item
            :key="item.id"
            class="flex-1 flex-grow-0"
            :class="{
              selected: isSelected(item),
              'en-1': isSelected(item),
              'elevation-2': isSelected(item),
            }"
            style="margin: 0px 0;"
          >
            <v-list-item-avatar>
              <v-btn
                icon
                style="cursor: pointer"
                @click.stop="openVersionDir(item)"
              >
                <v-icon>folder</v-icon>
              </v-btn>
            </v-list-item-avatar>
            <v-list-item-title
              style="flex: 1 1 50%"
              class="!flex-grow-0"
            >
              {{ item.id }}
            </v-list-item-title>
            <v-list-item-subtitle class="flex !flex-grow">
              {{ item.minecraft }}
            </v-list-item-subtitle>
            <v-list-item-action style="flex-direction: row; justify-content: flex-end;">
              <v-btn
                style="cursor: pointer"
                icon
                text
                @mousedown.stop
                @click.stop="startReinstall(item)"
              >
                <v-icon>build</v-icon>
              </v-btn>
            </v-list-item-action>
            <v-list-item-action style="flex-direction: row; justify-content: flex-end;">
              <v-btn
                style="cursor: pointer"
                icon
                color="error"
                text
                @mousedown.stop
                @click.stop="startDelete(item)"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </template>
      </div>

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
  </div>
</template>

<script lang=ts setup>
import { InstallServiceKey, LocalVersionHeader, versionCompare, VersionServiceKey } from '@xmcl/runtime-api'
import { useRefreshable, useService } from '@/composables'
import { usePresence } from '@/composables/presence'
import { injection } from '@/util/inject'
import { kLocalVersions } from '@/composables/versionLocal'

const props = withDefaults(defineProps<{
  value?: LocalVersionHeader
}>(), {
  value: undefined,
})

const filterText = ref('')

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
const versions = computed(() => localVersions.value.filter(v => v.id.indexOf(filterText.value) !== -1).filter(v => !data.filteredMinecraft || v.minecraft === data.filteredMinecraft))
const minecraftVersions = computed(() => [...new Set(localVersions.value.map(v => v.minecraft))].sort(versionCompare).reverse())
const { t } = useI18n()

function isSelected(v: LocalVersionHeader) {
  if (!props.value) return false
  return v.id === props.value.id
}
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
