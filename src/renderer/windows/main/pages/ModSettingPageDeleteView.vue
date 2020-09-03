<template>
  <v-card>
    <v-card-title primary-title>
      <div style="margin-bottom: 5px">
        <h3 class="headline mb-0">{{ $t('mod.deletion') }}</h3>
      </div>
      <div
        style="overflow: hidden; word-break: break-all;"
      >
        {{ $t('mod.deletionHint', { mod: name }) }}
      </div>
      <div style="overflow: hidden; word-break: break-all; color: #f44336; font-style: italic; font-weight: bold; padding: 5px 5px 0 0">{{ name }}</div>
    </v-card-title>

    <v-divider />
    <v-card-actions>
      <v-btn
        flat
        @click="cancel"
      >
        {{ $t('no') }}
      </v-btn>
      <v-spacer />
      <v-btn
        flat
        color="red"
        @click="confirm"
      >
        <v-icon left>delete</v-icon>
        {{ $t('delete.yes') }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script lang=ts>
import { defineComponent } from '@vue/composition-api';
import { required } from '@/util/props';

export default defineComponent({
  props: {
    confirm: required<() => void>(Function),
    cancel: required<() => void>(Function),
    name: required<string>(String),
  },
});
</script>

<style>
.card-list.right {
  display: flex;
  flex-flow: column;
}
</style>
