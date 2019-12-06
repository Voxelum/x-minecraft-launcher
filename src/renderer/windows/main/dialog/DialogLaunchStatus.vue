<template>
  <v-dialog v-model="isShown" :width="300" :persistent="status === 'launching'">
    <v-card v-if="status === 'error'" color="error">
      <v-card-title primary-title>
        {{ $t(`launch.failed.${errorType}`) }}
      </v-card-title>
      <v-card-text>
        {{ $t(`launch.failed.${errorType}Text`) }}
        <v-text-field
          readonly
          textarea
          :value="errors"
        />
      </v-card-text>
    </v-card>
    <v-card v-else dark>
      <v-container>
        <v-layout align-center justify-center column>
          <v-flex>
            <v-progress-circular :size="70" :width="7" color="white" indeterminate />
          </v-flex>
          <v-flex mt-3>
            {{ progressText }}
          </v-flex>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { useLaunch, useDialogSelf, useI18n } from '@/hooks';
import { ref, onMounted, watch } from '@vue/composition-api';

export default {
  setup() {
    const progressText = ref('');
    const { t } = useI18n();
    const { errorType, errors, status } = useLaunch();
    const { isShown, showDialog, closeDialog } = useDialogSelf('launch-status');
    onMounted(() => {
      watch(status, (s) => {
        switch (s) {
          case 'ready':
            closeDialog();
            break;
          case 'checkingProblems':
            showDialog();
            progressText.value = t('launch.checkingProblems');
            break;
          case 'launching':
            showDialog();
            progressText.value = t('launch.launching');
            setTimeout(() => { progressText.value = t('launch.launchingSlow'); }, 4000);
            break;
          case 'minecraftReady':
            closeDialog();
            break;
          case 'error':
            showDialog();
            break;
          default:
        }
      });
    });
    return {
      progressText,
      errorType,
      errors,
      status,
      isShown,
    };
  },
};
</script>

<style>
</style>
