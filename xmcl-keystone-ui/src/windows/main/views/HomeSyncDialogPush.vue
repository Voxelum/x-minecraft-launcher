<template>
  <div>
    <v-container class="overflow-auto max-h-60vh">
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
        {{ t('refresh') }}
      </v-btn>
      <v-btn
        text
        :loading="uploadingInstanceManifest"
        color="primary"
        @click="upload"
      >
        {{ t('upload') }}
      </v-btn>
    </v-card-actions>
  </div>
</template>
<script lang="ts" setup>
import { InstanceIOException, InstanceIOServiceKey, InstanceManifestSchema, isException, LocalInstanceManifest } from '@xmcl/runtime-api'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'
import { provideFileNodes, useInstanceFileNodesFromLocal } from '../composables/instanceFiles'
import { useI18n, useService, useServiceBusy } from '/@/composables'

const props = defineProps<{ shown: boolean }>()

const { getInstanceManifest, uploadInstanceManifest } = useService(InstanceIOServiceKey)
const gettingManifest = useServiceBusy(InstanceIOServiceKey, 'getInstanceManifest')
const uploadingInstanceManifest = useServiceBusy(InstanceIOServiceKey, 'uploadInstanceManifest')
const current = ref(undefined as undefined | LocalInstanceManifest)
const files = computed(() => current.value ? current.value.files : [])
const { t } = useI18n()

const selected = ref([] as string[])
const errorText = ref('')

const nodes = useInstanceFileNodesFromLocal(files, {
  modrinth: true,
  curseforge: true,
  downloads: true,
})
provideFileNodes(nodes)

async function refresh() {
  errorText.value = ''
  current.value = await getInstanceManifest()
  console.log(current.value)
}

async function upload() {
  errorText.value = ''
  if (current.value) {
    const all = new Set(selected.value)

    const result: InstanceManifestSchema = {
      ...current.value,
    }
    result.files = result.files.filter(f => all.has(f.path)).map(f => ({
      path: f.path,
      hashes: f.hashes,
      downloads: f.downloads,
      curseforge: f.curseforge,
      modrinth: f.modrinth,
    }))
    try {
      await uploadInstanceManifest({
        manifest: result,
      })
    } catch (e) {
      if (isException(InstanceIOException, e)) {
        if (e.exception.type === 'instanceSetManifestFailed' && e.exception.statusCode >= 400 && e.exception.statusCode < 500) {
          errorText.value = t('authError')
          return
        }
      }
      errorText.value = t('unknownError')
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

<i18n locale="en" lang="yaml">
unknownError: Unknown Server Error. Please retry.
authError: Bad user authentication. Please make sure you have privilege to upload files of the server!
refresh: Refresh
upload: Upload Instance
</i18n>

<i18n locale="zh-CN" lang="yaml">
unknownError: 未知错误，请重试
authError: 用户验证失败，请确定你是更新服务器的管理员！
refresh: 刷新
upload: 上传更新
</i18n>
