<template>
  <v-snackbar v-model="show" :top="true" :right="true">
    <v-icon :color="colors[status]" left>
      {{ icons[status] }}
    </v-icon>

    {{ content }}
    
    {{ $t(`log.${status}`) }}
    <v-btn v-if="error" style="margin-right: -30px" flat @click="errorDialog = true">
      <v-icon>arrow_right</v-icon>
    </v-btn>
    <v-btn color="pink" flat @click="close">
      <v-icon>close</v-icon>
    </v-btn>
    <v-dialog v-model="errorDialog">
      <v-card>
        <v-card-title
          class="headline"
          primary-title
        >
          Error
        </v-card-title>

        <v-card-text>
          {{ error }}
        </v-card-text>

        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            flat
            @click="errorDialog = false"
          >
            {{ $t('ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-snackbar>
</template>

<script>
import Vue from 'vue';
import { reactive, toRefs, onMounted, onUnmounted } from '@vue/composition-api';
import { ipcRenderer } from 'electron';
import { useStore, useI18n, useNotifier } from '@/hooks';

export default {
  setup() {
    const { state } = useStore();
    const { t } = useI18n();
    const data = reactive({
      errorDialog: false,
    });
    const { status, content, error, show } = useNotifier();
    return {
      ...toRefs(data),
      close() { show.value = false; },
      status,
      content,
      error,
      show,
      icons: {
        success: 'check_circle',
        info: 'info',
        warning: 'priority_high',
        error: 'warning',
      },
      colors: {
        success: 'green',
        error: 'red',
        info: 'white',
        warning: 'orange',
      },
    };
  },
};
</script>

<style>
</style>
