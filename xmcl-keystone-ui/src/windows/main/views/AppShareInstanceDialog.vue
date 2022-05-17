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
          {{ t('title') }}
        </v-toolbar-title>
      </v-toolbar>

      <v-container
        grid-list-sm
        class="max-h-[50vh] visible-scroll"
        style="overflow: auto;"
      >
        <v-card-text>
          {{ t('description') }}
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
                  :src="minecraftPng"
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
                  :src="forgePng"
                  width="32"
                >
              </template>
            </v-text-field>
            <v-text-field
              v-if="fabricLoader"
              flat
              dense
              label="Fabric"
              :value="fabricLoader"
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="fabricPng"
                  width="32"
                >
              </template>
            </v-text-field>
            <!-- <v-text-field

              flat
              :value="optifine"
              dense
              readonly
            >
              <template #prepend-inner>
                <img
                  :src="forgePng"
                  width="32"
                >
              </template>
            </v-text-field> -->
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
        <v-subheader>{{ t('filesInfo') }}</v-subheader>

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
      <v-card-actions>
        <v-btn
          text
          color="error"
          @click="onCancelShare"
        >
          <v-icon left>
            delete
          </v-icon>
          {{ t('cancel') }}
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
    </v-card>
  </v-dialog>
</template>
<script lang="ts" setup>
import { useDialog } from '../composables/dialog'
import { useI18n, useService } from '/@/composables'
import { InstanceIOServiceKey, LocalInstanceFile, LocalInstanceManifest, PeerServiceKey } from '@xmcl/runtime-api'
import InstanceManifestFileTree from '../components/InstanceManifestFileTree.vue'
import { Ref } from '@vue/composition-api'
import { provideFileNodes, useInstanceFileNodesFromLocal } from '../composables/instanceFiles'
import fabricPng from '/@/assets/fabric.png'
import forgePng from '/@/assets/forge.png'
import minecraftPng from '/@/assets/minecraft.png'
import { useNotifier } from '../composables/notifier'

const { isShown } = useDialog('share-instance')

const { getInstanceManifest } = useService(InstanceIOServiceKey)
const { shareInstance } = useService(PeerServiceKey)
const { t } = useI18n()
const { subscribeTask } = useNotifier()

const manifest: Ref<LocalInstanceManifest | undefined> = ref(undefined)
const selected = ref([] as string[])

provideFileNodes(useInstanceFileNodesFromLocal(computed(() => manifest.value?.files || []), {
  curseforge: true,
  modrinth: true,
  downloads: true,
}))

const minecraft = computed(() => manifest.value?.runtime.minecraft)
const forge = computed(() => manifest.value?.runtime.forge)
const fabricLoader = computed(() => manifest.value?.runtime.fabricLoader)
const optifine = computed(() => manifest.value?.runtime.optifine)
const mcOptions = computed(() => manifest.value?.mcOptions || [])
const vmOptions = computed(() => manifest.value?.vmOptions || [])
const loading = ref(false)

const onCancelShare = () => {
  shareInstance({ manifest: undefined })
  isShown.value = false
}

const onShareInstance = () => {
  subscribeTask(shareInstance({ manifest: manifest.value }), t('shareNotifyTitle'))
  isShown.value = false
}

watch(isShown, async (shown) => {
  if (shown) {
    loading.value = true
    manifest.value = await getInstanceManifest().finally(() => { loading.value = false })
  }
})

defineProps<{ }>()
</script>

<i18n locale="zh-CN" lang="yaml">
shareNotifyTitle: 分享配置
description: 分享后，你的联机伙伴将会可以通过你下载你分享的游戏资源
share: 分享
cancel: 取消分享
title: 分享启动配置给其他玩家
baseInfo: 分享的基本配置
filesInfo: 选择分享的文件
</i18n>
