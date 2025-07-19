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
            align-tabs="center"
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
        <v-tabs-window v-model="tab">
          <v-tabs-window-item :key="0">
            <HomeSyncDialogPull :shown="tab === 0" />
          </v-tabs-window-item>
          <v-tabs-window-item :key="1">
            <HomeSyncDialogPush :shown="tab === 1" />
          </v-tabs-window-item>
        </v-tabs-window>
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
