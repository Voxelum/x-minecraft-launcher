<template>
  <v-dialog v-model="isShown" :width="550" :persistent="true">
    <v-toolbar color="error">
      <v-toolbar-title class="white--text">
        {{ $t('launch.failed.title') }}
      </v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="isShown=false">
        <v-icon>arrow_drop_down</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card>
      <v-card-text>
        <div style="padding: 10px">
          {{ $t(`launch.failed.description`) }}
        </div>
        <div style="min-height: 400px; max-height: 400px; overflow: auto; ">
          <v-textarea 
            auto-grow
            autofocus
            box
            readonly
            hide-details
            :value="log" 
            style="margin: 8px; line-height: 30px" />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { ref, onMounted, watch, computed, reactive, toRefs } from '@vue/composition-api';
import { useLaunch, useDialogSelf, useI18n, useIssues, useIpc, useInstanceLogs } from '@/hooks';

export default {
  setup() {
    const ipc = useIpc();
    const data = reactive({
      isShown: false,
      log: '',
    });
    const { getLogContent } = useInstanceLogs();
    function decorate(log: string) {
      let lines = log.split('\n');
      let result: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        result.push(lines[i].trim(), ' ');
      }
      return result.join('\n');
    }
    async function displayLog() {
      let log = await getLogContent('latest.log');
      data.log = decorate(log);
      data.isShown = true;
    }
    ipc.on('minecraft-exit', (event, { code, signal, crashReport, crashReportLocation }) => {
      console.log('exit!');
      if (code !== 0) {
        displayLog();
      }
    });

    return {
      ...toRefs(data),
    };
  },
};
</script>

<style>
</style>
