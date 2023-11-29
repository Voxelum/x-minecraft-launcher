<template>
  <div>
    <v-container class="max-h-60vh overflow-auto">
      <v-skeleton-loader
        v-if="gettingManifest"
        type="list-item-avatar-three-line,list-item-avatar-three-line,list-item-avatar-three-line"
      />
      <InstanceManifestFileTree
        v-else
        v-model="selected"
        selectable
      />
    </v-container>

    <v-card-actions>
      <v-alert
        :value="!!errorText"
        outlined
        border="left"
        dense
        transition="scale-transition"
        type="error"
      >
        {{ errorText }}
      </v-alert>
      <v-spacer />
      <v-btn
        text
        :loading="gettingManifest"
        @click="refresh"
      >
        {{ t('HomeSyncDialogPush.refresh') }}
      </v-btn>
      <v-btn
        text
        :loading="uploadingInstanceManifest"
        color="primary"
        @click="upload"
      >
        {{ t('HomeSyncDialogPush.upload') }}
      </v-btn>
    </v-card-actions>
  </div>
</template>
<script lang="ts" setup>
import { InstanceIOException, InstanceManifest, isException, XUpdateServiceKey, InstanceManifestServiceKey } from '@xmcl/runtime-api'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'
import { useService, useServiceBusy } from '@/composables'
import { provideFileNodes, useInstanceFileNodesFromLocal } from '@/composables/instanceFileNodeData'
import { injection } from '@/util/inject'
import { kInstance } from '@/composables/instance'

const props = defineProps<{ shown: boolean }>()

const { getInstanceManifest } = useService(InstanceManifestServiceKey)
const { uploadInstanceManifest } = useService(XUpdateServiceKey)
const { path } = injection(kInstance)
const gettingManifest = useServiceBusy(InstanceManifestServiceKey, 'getInstanceManifest')
const uploadingInstanceManifest = useServiceBusy(XUpdateServiceKey, 'uploadInstanceManifest')
const current = ref(undefined as undefined | InstanceManifest)
const files = computed(() => current.value ? current.value.files : [])
const { t } = useI18n()

const selected = ref([] as string[])
const errorText = ref('')

const nodes = useInstanceFileNodesFromLocal(files)
provideFileNodes(nodes)

async function refresh() {
  errorText.value = ''
  current.value = await getInstanceManifest({ path: path.value })
  console.log(current.value)
}

async function upload() {
  errorText.value = ''
  if (current.value) {
    const all = new Set(selected.value)

    const result: InstanceManifest = {
      ...current.value,
    }
    result.files = result.files.filter(f => all.has(f.path)).map(f => ({
      path: f.path,
      hashes: f.hashes,
      downloads: f.downloads,
      curseforge: f.curseforge,
      modrinth: f.modrinth,
      size: 0,
    }))
    try {
      await uploadInstanceManifest({
        manifest: result,
        path: path.value,
      })
    } catch (e) {
      if (isException(InstanceIOException, e)) {
        if (e.exception.type === 'instanceSetManifestFailed' && e.exception.statusCode >= 400 && e.exception.statusCode < 500) {
          errorText.value = t('HomeSyncDialogPush.authError')
          return
        }
      }
      errorText.value = t('HomeSyncDialogPush.unknownError')
    }
  }
}

watch(() => props.shown, (opened) => {
  console.log(`push ${opened}`)
  if (opened) {
    refresh()
  }
})
</script>
