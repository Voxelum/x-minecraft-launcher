<template>
  <v-snackbar v-model="show" :top="true" :right="true">
    <v-icon :color="colors[status]" left>
      {{ icons[status] }}
    </v-icon>

    {{ title }}
    
    {{ $t(`log.${status}`) }}
    <v-btn v-if="content" style="margin-right: -30px" flat @click="more">
      <v-icon>arrow_right</v-icon>
    </v-btn>
    <v-btn color="pink" flat @click="close">
      <v-icon>close</v-icon>
    </v-btn>
  </v-snackbar>
</template>

<script lang=ts>
import { createComponent } from '@vue/composition-api';
import { useNotifier, useDialog } from '@/hooks';

export default createComponent({
  setup() {
    const { status, title, content, error, show } = useNotifier();
    const { showDialog } = useDialog('detail');
    function more() {
      showDialog();
    }
    return {
      close() { show.value = false; },
      status,
      title,
      content,
      error,
      show,
      more,
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
});
</script>

<style>
</style>
