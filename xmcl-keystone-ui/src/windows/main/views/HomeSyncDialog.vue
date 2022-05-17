<template>
  <v-dialog
    v-model="isShown"
    width="800"
  >
    <v-card>
      <v-toolbar color="secondary">
        <v-toolbar-title>{{ t('title') }}</v-toolbar-title>

        <template #extension>
          <v-tabs
            v-model="tab"
            centered
          >
            <v-tabs-slider color="yellow" />
            <v-tab>
              {{ t('pull') }}
            </v-tab>
            <v-tab>
              {{ t('push') }}
            </v-tab>
          </v-tabs>
        </template>
      </v-toolbar>
      <v-container class="max-h-[70vh]">
        <v-tabs-items v-model="tab">
          <v-tab-item :key="0">
            <HomeSyncDialogPull :shown="tab === 0" />
          </v-tab-item>
          <v-tab-item :key="1">
            <HomeSyncDialogPush :shown="tab === 1" />
          </v-tab-item>
        </v-tabs-items>
      </v-container>
    </v-card>
  </v-dialog>
</template>
<script lang="ts" setup>
import { useDialog } from '../composables/dialog'
import HomeSyncDialogPull from './HomeSyncDialogPull.vue'
import HomeSyncDialogPush from './HomeSyncDialogPush.vue'
import { useI18n } from '/@/composables'

const { isShown } = useDialog('instance-sync')
const { t } = useI18n()

const tab = ref(0)

watch(isShown, (v) => {
  if (!v) {
    tab.value = 0
  }
})

</script>

<i18n locale="en" lang="yaml">
pull: Pull
push: Push
title: Instance Sync
</i18n>

<i18n locale="zh-CN" lang="yaml">
pull: 拉取更新
push: 上传实例
title: 实例同步
</i18n>
