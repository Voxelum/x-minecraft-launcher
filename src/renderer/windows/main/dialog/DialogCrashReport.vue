<template>
  <v-dialog v-model="isShown" persistent>
    <v-toolbar dark tabs color="grey darken-3">
      <v-toolbar-title>{{ $t('launch.crash') }}</v-toolbar-title>
      <v-spacer />
      <v-toolbar-items>
        <v-btn flat @click="openFolder">
          {{ $t('launch.openCrashReportFolder') }}
        </v-btn>
      </v-toolbar-items>
      <v-btn icon @click="closeDialog()">
        <v-icon>close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card flat style="min-height: 300px; overflow-y: auto;" dark>
      <v-textarea hide-details solo style="max-height: 400px" background-color="grey darken-4"
                  readonly auto-grow :value="content" flat />
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, toRefs, onMounted, onUnmounted, createComponent } from '@vue/composition-api';
import Vue from 'vue';
import { useDialogSelf, useIpc, useBaseService } from '@/hooks';

export default createComponent({
  setup() {
    const { isShown, showDialog, closeDialog } = useDialogSelf('crash-report');
    const ipcRenderer = useIpc();
    const { showItemInDirectory } = useBaseService();
    const data = reactive({
      content: '',
      location: '',
    });
    function onMinecraftExit(event: any, status: any) {
      if (status.crashReport) {
        Vue.nextTick(() => {
          showDialog();
          data.content = status.crashReport;
          data.location = status.crashReportLocation || '';
        });
      }
    }
    onUnmounted(() => {
      ipcRenderer.removeListener('minecraft-exit', onMinecraftExit);
    });
    onMounted(() => {
      ipcRenderer.on('minecraft-exit', onMinecraftExit);
    });
    return {
      isShown,
      ...toRefs(data),
      closeDialog,
      openFolder() {
        showItemInDirectory(data.location);
      },
    };
  },
});
</script>

<style>
</style>
