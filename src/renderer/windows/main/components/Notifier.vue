<template>
  <v-snackbar v-model="show" :top="true" :right="true" :timeout="100000000">
    <v-icon :color="colors[status]" left>
      {{ icons[status] }}
    </v-icon>

    {{ title }}
    
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

<script lang=ts>
import { reactive, toRefs, createComponent, onMounted } from '@vue/composition-api';
import { useNotifier } from '@/hooks';

export default createComponent({
  setup() {
    const data = reactive({
      errorDialog: false,
      showMore: false,
    });
    const { status, title, content, error, show } = useNotifier();
    onMounted(() => {
      show.value = true;
      title.value = 'XXXERROR';
      content.value = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';
    });
    function more() {
      data.showMore = !data.showMore;
    }
    return {
      ...toRefs(data),
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
