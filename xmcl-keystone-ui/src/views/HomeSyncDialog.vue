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
              {{ t('HomeSyncDialog.pull') }}
            </v-tab>
            <v-tab>
              {{ t('HomeSyncDialog.push') }}
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

const { isShown } = useDialog('instance-sync')
const { t } = useI18n()

const tab = ref(0)

watch(isShown, (v) => {
  if (!v) {
    tab.value = 0
  }
})

</script>
