<template>
  <v-dialog v-model="isShown" persistent>
    <v-toolbar dark tabs color="grey darken-3">
      <v-toolbar-title>{{ $t('launch.crash') }}</v-toolbar-title>
      <v-spacer />
      <v-toolbar-items>
        <v-btn flat @click="openFolder">
          {{ $t('launch.openCrashReportFolder') }}
        </v-btn>
        <v-btn flat @click="openFile">
          {{ $t('launch.openCrashReport') }}
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

<script>
import { reactive, toRefs, onMounted, onUnmounted } from '@vue/composition-api';
import { ipcRenderer } from 'electron';
import { useDialogSelf, useStore } from '@/hooks';

export default {
  setup() {
    const { isShown, showDialog, closeDialog } = useDialogSelf('crash-report');
    const { dispatch } = useStore(); 
    const data = reactive({
      content: '',
      location: '',
    });
    function onMinecraftExit(event, status) {
      if (status.crashReport) {
        showDialog();
        data.content = status.crashReport;
        data.location = status.crashReportLocation || '';
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
      openFile() {
        dispatch('openItem', this.location);
      },
      openFolder() {
        dispatch('showItemInFolder', this.location);
      },
    };
  },
  methods: {
    
   
  },
};
</script>

<style>
</style>
