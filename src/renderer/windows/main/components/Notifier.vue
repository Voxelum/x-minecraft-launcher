<template>
  <v-snackbar v-model="snackbar" :top="true" :right="true">
    <v-icon :color="colors[status]" left>
      {{ icons[status] }}
    </v-icon>

    {{ content }}
    
    {{ $t(`log.${status}`) }}
    <v-btn v-if="error" style="margin-right: -30px" flat @click="errorDialog = true">
      <v-icon>arrow_right</v-icon>
    </v-btn>
    <v-btn color="pink" flat @click="snackbar = false">
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

export default {
  data: () => ({
    snackbar: false,
    errorDialog: false,

    content: '',
    status: '',
    error: '',

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
  }),
  mounted() {
    this.$electron.ipcRenderer.addListener('task-successed', this.onSuccessed);
    this.$electron.ipcRenderer.addListener('task-failed', this.onFailed);

    Vue.prototype.$notify = this.notify.bind(this);
  },
  destroyed() {
    this.$electron.ipcRenderer.removeListener('task-successed', this.onSuccessed);
    this.$electron.ipcRenderer.removeListener('task-failed', this.onFailed);
  },
  methods: {
    notify(status, content) {
      this.status = status;
      this.content = content;
      this.snackbar = true;
    },
    onSuccessed(event, id) {
      this.snackbar = true;
      const task = this.$repo.state.task.tree[id];
      if (task.background) return;
      this.content = this.$t(task.path, task.arguments || {});
      this.status = 'success';
    },
    onFailed(event, id, error) {
      this.snackbar = true;
      const task = this.$repo.state.task.tree[id];
      if (task.background) return;
      this.content = this.$t(task.path, task.arguments || {});
      this.status = 'error';
      this.error = error;
    },
  },
};
</script>

<style>
</style>
