<template>
  <v-dialog :value="value" width="500">
    <v-card>
      <v-card-title
        class="headline"
        primary-title
      >
        {{ $t('save.deleteTitle') }}
      </v-card-title>

      <v-card-text>
        {{ $t('save.deleteHint') }}
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="red"
          flat
          @click="cancel"
        >
          {{ $t('save.deleteCancel') }}
        </v-btn>
        <v-btn
          color="primary"
          flat
          @click="operate"
        >
          {{ $t('save.deleteConfirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { createComponent } from '@vue/composition-api';

export default createComponent({
  props: {
    cancel: {
      type: Function,
    },
    operate: {
      type: Function,
    },
    value: {
      type: String,
    },
  },
});
</script>

<style>
</style>
