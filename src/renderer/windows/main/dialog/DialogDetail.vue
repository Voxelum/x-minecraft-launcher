<template>
  <v-dialog :value="isShown" :hide-overlay="true" width="500">
    <v-card color="shades" :dark="false">
      <v-card-title
        class="headline"
        primary-title
        style="text-align: center"
      >
        {{ title }}
      </v-card-title>

      <v-divider />

      <v-card-text>
        {{ content }}
      </v-card-text>
      <v-textarea v-if="errorContent" box hide-details :value="errorContent" />
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          flat
          @click="closeDialog"
        >
          {{ $t('ok') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts">
import { createComponent, computed } from '@vue/composition-api';
import { useDialogSelf, useNotifier } from '@/hooks';

export default createComponent({
  setup() {
    const { isShown, closeDialog } = useDialogSelf('detail');
    const { error, title, content } = useNotifier();
    const errorContent = computed(() => error.value?.stack);
    return {
      isShown,
      title,
      content,
      error,
      closeDialog,
      errorContent,
    };
  },
});
</script>
