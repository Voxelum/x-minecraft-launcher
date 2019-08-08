<template>
  <v-dialog :value="value" hide-overlay transition="dialog-bottom-transition" @input="$emit('input', false)" width="500">
    <v-toolbar color="warning">
      <v-btn icon dark @click="$emit('input', false)">
        <v-icon>close</v-icon>
      </v-btn>
      <v-toolbar-title> {{ $t('feedback') }} </v-toolbar-title>
      <v-spacer />
      <!-- <v-toolbar-items>
        <v-btn dark flat>
          {{ $t('feedback') }}
        </v-btn>
      </v-toolbar-items> -->
      <!-- <template v-slot:extension> -->
      <!-- <v-tabs v-model="model" centered color="cyan"> -->
      <!-- <v-tab :key="i" :href="`#tab-${i}`"/> -->
      <!-- </v-tabs> -->
      <!-- </template> -->
    </v-toolbar>
    <v-list three-line subheader>
      <v-subheader>{{ $t('feedback.description') }}</v-subheader>
      <v-list-tile avatar>
        <v-list-tile-content>
          <v-list-tile-title> {{ $t('feedback.github') }}</v-list-tile-title>
          <v-list-tile-sub-title> {{ $t('feedback.githubDescription') }} </v-list-tile-sub-title>
        </v-list-tile-content>
        <v-list-tile-action>
          <v-btn flat href="https://github.com/Voxelum/VoxeLauncher/issues/new">
            {{ $t('feedback.githubOpenIssue') }}
          </v-btn>
        </v-list-tile-action>
      </v-list-tile>
      <v-list-tile avatar>
        <v-list-tile-content>
          <v-list-tile-title> {{ $t('feedback.qq') }} </v-list-tile-title>
          <v-list-tile-sub-title> {{ $t('feedback.qqDescription') }} </v-list-tile-sub-title>
        </v-list-tile-content>

        <v-list-tile-action>
          <v-btn flat href="https://jq.qq.com/?_wv=1027&k=5Py5zM1">
            {{ $t('feedback.qqEnterGroup') }}
          </v-btn>
        </v-list-tile-action>
      </v-list-tile>
    </v-list>
  </v-dialog>
</template>

<script>
export default {
  props: {
    value: {
      type: Boolean,
      default: () => false,
    },
  },
  data: () => ({
    hovered: {},
  }),
  watch: {
    value() {
      this.$emit('value', this.value);
    },
  },
};
</script>

<style>
.diff {
  color: #81c784;
  font-style: italic;
}
</style>
