<template>
  <v-dialog :value="value" :width="500" :persistent="launchStatus === 'launching'" @input="$emit('input', $event)">
    <v-card v-if="launchStatus === 'error'" color="error">
      <v-card-title primary-title>
        {{ $t(`launch.failed.${launchErrorType}`) }}
      </v-card-title>
      <v-card-text>
        {{ $t(`launch.failed.${launchErrorType}Text`) }}
        <v-text-field
          readonly
          textarea
          :value="launchErrors"
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
      progressText: '',
    };
  },
  computed: {
    launchStatus() { return this.$repo.state.launch.status; },
    launchErrorType() { return this.$repo.state.launch.errorType; },
    launchErrors() { 
      return this.$repo.state.launch.errors.map((e) => {
        if (e instanceof Error) {
          return e.stack;
        } 
        return JSON.stringify(e);
      }).join('\n');
    },
  },
  watch: {
    launchStatus() {
      switch (this.launchStatus) {
        case 'ready':
          this.$emit('input', false);
          break;
        case 'checkingProblems':
          this.$emit('input', true);
          this.progressText = this.$t('launch.checkingProblems');
          break;
        case 'launching':
          this.$emit('input', true);
          this.progressText = this.$t('launch.launching');
          setTimeout(() => { this.progressText = this.$t('launch.launchingSlow'); }, 4000);
          break;
        case 'minecraftReady':
          this.$emit('input', false);
          break;
        case 'error':
          this.$emit('input', true);
          break;
        default:
      }
    },
  },
};
</script>

<style>
</style>
