<template>
  <v-card>
    <v-card-title primary-title>
      <div>
        <h3 class="headline mb-0">{{ $t('mod.deletion', { mod: name }) }}</h3>
        <div>{{ $t('mod.deletionHint') }}</div>
      </div>
    </v-card-title>

    <v-divider />
    <v-card-actions>
      <v-btn flat @click="cancel">{{ $t('no') }}</v-btn>
      <v-spacer />
      <v-btn flat color="red" @click="confirm">
        <v-icon left>delete</v-icon>
        {{ $t('yes') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';

export interface Props {
  confirm(): void;
  cancel(): void;
  name: string;
}

export default defineComponent<Props>({
  props: {
    confirm: Function,
    cancel: Function,
    name: String,
  },
});
</script>

<style>
.card-list.right {
  display: flex;
  flex-flow: column;
}
</style>
