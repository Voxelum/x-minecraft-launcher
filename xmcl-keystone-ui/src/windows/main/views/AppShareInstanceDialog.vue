<template>
  <v-dialog
    v-model="isShown"
    width="700"
  >
    <v-card>
      <v-toolbar
        color="green en"
      >
        <v-toolbar-title>
          <template v-if="sharing">
            {{ t('shareTitle') }}
          </template>
          <template v-else>
            {{ t('downloadTitle') }}
          </template>
        </v-toolbar-title>
      </v-toolbar>

      <v-container
        grid-list-sm
        class="max-h-[70vh] visible-scroll"
        style="overflow: auto;"
      >
        <v-card-text>
          <template v-if="sharing">
            {{ t('description') }}
          </template>
          <template v-else>
            {{ t('downloadDescription') }}
          </template>
        </v-card-text>
        <v-subheader>{{ t('baseInfo') }}</v-subheader>
        <div class="flex flex-col p-5 ">
          <div class="flex gap-5">
            <v-text-field
              flat
              :value="minecraft"
              label="Minecraft"
              dense
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="'image:builtin:minecraft'"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="forge"
              flat
              dense
              label="Forge"
              :value="forge"
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="'image:builtin:forge'"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="fabricLoader"
              flat
              dense
              label="Fabric"
              :value="'fabricLoader'"
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="'image:builtin:fabric'"
                  width="32"
                >
              </template>
            </v-text-field>
          </div>
          <div class="flex gap-5">
            <v-text-field
              v-if="vmOptions.length > 0"
              :value="vmOptions"
              readonly
              :label="t('instance.vmOptions')"
            />
          </div>
          <div class="flex gap-5">
            <v-text-field
              v-if="mcOptions.length > 0"
              :value="mcOptions"
              readonly
              :label="t('instance.mcOptions')"
            />
          </div>
        </div>
        <v-subheader>
          <template v-if="sharing">
            {{ t('filesToShare') }}
          </template>
          <template v-else>
            {{ t('filesToDownload') }}
          </template>
        </v-subheader>

        <div v-if="loading">
          <v-skeleton-loader
            class="flex flex-col gap-3 overflow-auto"
            type="list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line, list-item-avatar-two-line"
          />
        </div>
        <InstanceManifestFileTree
          v-else
          v-model="selected"
          selectable
          multiple
        />
      </v-container>
      <v-card-actions v-if="sharing">
        <v-btn
          text
          color="error"
          @click="onCancelShare"
        >
          <v-icon left>
            delete
          </v-icon>
          {{ t('cancelShare') }}
        </v-btn>
        <v-spacer />
        <v-btn
          text
          color="primary"
          @click="onShareInstance"
        >
          <v-icon left>
            share
          </v-icon>
          {{ t('share') }}
        </v-btn>
      </v-card-actions>
      <v-card-actions v-else>
        <v-btn
          text
          @click="isShown = false"
        >
          {{ t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-btn
          text
          color="primary"
          @click="onDownloadInstance"
        >
          <v-icon left>
            download
          </v-icon>
          {{ t('download') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script lang="ts" setup>
import { Ref } from '@vue/composition-api'
import { InstanceInstallServiceKey, InstanceManifest, InstanceManifestServiceKey, InstanceServiceKey, PeerServiceKey } from '@xmcl/runtime-api'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'
import { useDialog } from '../composables/dialog'
import { provideFileNodes, useInstanceFileNodesFromLocal } from '../composables/instanceFiles'
import { useNotifier } from '../composables/notifier'
import { useI18n, useRouter, useService } from '/@/composables'

const { isShown, show, parameter } = useDialog('share-instance')

const { installInstanceFiles } = useService(InstanceInstallServiceKey)
const { getInstanceManifest } = useService(InstanceManifestServiceKey)
const { shareInstance, state, on } = useService(PeerServiceKey)
const { state: instanceState } = useService(InstanceServiceKey)
const { t } = useI18n()
const { subscribeTask } = useNotifier()
const { notify } = useNotifier()
const router = useRouter()

on('share', (event) => {
  if (event.manifest) {
    const man = event.manifest
    const conn = state.connections.find(c => c.id === event.id)
    if (conn) {
      notify({
        level: 'info',
        title: t('instanceShare', { user: conn.userInfo.name }),
        full: true,
        more() {
          if (!isShown.value) {
            router.push('/multiplayer')
            show({
              ...man,
              files: man.files.map(f => ({
                ...f,
                size: 0,
                isDirectory: false,
              })),
            })
            isShown.value = true
          }
        },
      })
    }
  }
})

const sharing = computed(() => isShown.value && !parameter.value)
/**
 * The sharing user name. Only for sharing == false
 */
const currentUser = ref('')
const manifest: Ref<InstanceManifest | undefined> = ref(undefined)
const selected = ref([] as string[])

provideFileNodes(useInstanceFileNodesFromLocal(computed(() => manifest.value?.files || [])))

const minecraft = computed(() => manifest.value?.runtime.minecraft)
const forge = computed(() => manifest.value?.runtime.forge)
const fabricLoader = computed(() => manifest.value?.runtime.fabricLoader)
const optifine = computed(() => manifest.value?.runtime.optifine)
const mcOptions = computed(() => manifest.value?.mcOptions || [])
const vmOptions = computed(() => manifest.value?.vmOptions || [])
const loading = ref(false)

const onCancelShare = () => {
  shareInstance({ manifest: undefined, instancePath: instanceState.path })
  isShown.value = false
}

const onShareInstance = () => {
  if (manifest.value) {
    const man = { ...manifest.value }
    const allow = new Set(selected.value)
    man.files = man.files.filter(f => allow.has(f.path))
    subscribeTask(shareInstance({ manifest: man, instancePath: instanceState.path }), t('shareNotifyTitle'))
    isShown.value = false
  }
}

const onDownloadInstance = () => {
  if (manifest.value) {
    const man = manifest.value
    let files = man.files
    const allow = new Set(selected.value)
    files = files.filter(f => allow.has(f.path))

    subscribeTask(installInstanceFiles({
      files,
    }), t('downloadNotifyTitle', { user: currentUser.value }))

    isShown.value = false
  }
}

watch(isShown, async (shown) => {
  if (shown) {
    if (parameter.value) {
      manifest.value = parameter.value as any
    } else {
      loading.value = true
      manifest.value = await getInstanceManifest({ path: instanceState.path, hashes: ['sha1'] }).finally(() => { loading.value = false })
    }
  }
})
</script>

<i18n locale="en" lang="yaml">
shareNotifyTitle: Share Instance
downloadNotifyTitle: Download Instance from {user}
description: After you share the profile, other place can download these files through your PC.
downloadDescription: Please verify the files your peer provided to you. Select the file you want to download.
share: Share
cancel: Cancel
cancelShare: Cancel Share
shareTitle: Share game files to other player
downloadTitle: Download files from other peers
baseInfo: Basic Setting
filesToShare: Choose files to share
filesToDownload: Choose files to download
downloadToLocal: Download to current instance
instanceShare: "{user} just shared a game files to you"
</i18n>

<i18n locale="zh-CN" lang="yaml">
shareNotifyTitle: 分享配置
description: 分享后，你的联机伙伴将会可以通过你下载你分享的游戏资源
downloadDescription: 请选择你想从你的小伙伴那下载的文件。
share: 分享
cancel: 取消
cancelShare: 取消分享
shareTitle: 分享启动配置给其他玩家
downloadTitle: 从其他玩家那获得游戏资源
baseInfo: 分享的基本配置
filesToShare: 选择分享的文件
filesToDownload: 选择你想下载的文件
downloadToLocal: 下载到当前实例种
instanceShare: "{user} 给你分享了他的游戏配置"
</i18n>
