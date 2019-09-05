<template>
  <v-dialog :value="value" persistent @input="$emit('input', $event)">
    <v-toolbar dark tabs color="grey darken-3">
      <v-toolbar-title>{{ $t('launch.crash') }}</v-toolbar-title>
      <v-spacer />
      <v-toolbar-items>
        <v-btn flat @click="openFolder">
          {{ $t('launch.openCrashReportFolder') }}
        </v-btn>
        <v-btn flat @click="openFile">
          {{ $t('launch.openCrashReport') }}
        </v-btn>
      </v-toolbar-items>
      <v-btn icon @click="$emit('input', false)">
        <v-icon>close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card flat style="min-height: 300px; overflow-y: auto;" dark>
      <v-textarea hide-details solo style="max-height: 400px" background-color="grey darken-4"
                  readonly auto-grow :value="content" flat />
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      content: '',
      location: '', 
    };
  },
  mounted() {
    this.$electron.ipcRenderer.on('minecraft-exit', (event, status) => {
      if (status.crashReport) {
        this.$emit('input', true);
        this.content = status.crashReport;
        this.location = status.crashReportLocation || '';
      }
    });
  },
  methods: {
    openFile() {
      this.$repo.dispatch('openItem', this.location);
    },
    openFolder() {
      this.$repo.dispatch('showItemInFolder', this.location);
    },
  },
};
</script>

<style>
</style>
