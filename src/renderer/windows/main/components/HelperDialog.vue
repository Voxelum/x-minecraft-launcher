<template>
  <v-dialog :value="value" hide-overlay transition="dialog-bottom-transition" @input="$emit('input', false)">
    <v-toolbar dark>
      <v-btn icon dark @click="$emit('input', false)">
        <v-icon>close</v-icon>
      </v-btn>
      <v-toolbar-title> Help Me </v-toolbar-title>
      <v-spacer />
      <v-toolbar-items>
        <v-btn dark flat>
          {{ $t('intro.feedback') }}
        </v-btn>
      </v-toolbar-items>
      <!-- <template v-slot:extension> -->
      <!-- <v-tabs v-model="model" centered color="cyan"> -->
      <!-- <v-tab :key="i" :href="`#tab-${i}`"/> -->
      <!-- </v-tabs> -->
      <!-- </template> -->
    </v-toolbar>
    <v-list three-line subheader>
      <v-subheader>User Controls</v-subheader>
      <v-list-tile avatar>
        <v-list-tile-content>
          <v-list-tile-title>Content filtering</v-list-tile-title>
          <v-list-tile-sub-title>Set the content filtering level to restrict apps that can be downloaded</v-list-tile-sub-title>
        </v-list-tile-content>
      </v-list-tile>
      <v-list-tile avatar>
        <v-list-tile-content>
          <v-list-tile-title>Password</v-list-tile-title>
          <v-list-tile-sub-title>Require password for purchase or use password to restrict purchase</v-list-tile-sub-title>
        </v-list-tile-content>
      </v-list-tile>
    </v-list>
    <v-divider />
    <v-list three-line subheader>
      <v-subheader>General</v-subheader>
      <v-list-tile avatar>
        <v-list-tile-action>
          <v-checkbox />
        </v-list-tile-action>
        <v-list-tile-content>
          <v-list-tile-title>Notifications</v-list-tile-title>
          <v-list-tile-sub-title>Notify me about updates to apps or games that I downloaded</v-list-tile-sub-title>
        </v-list-tile-content>
      </v-list-tile>
      <v-list-tile avatar>
        <v-list-tile-action>
          <v-checkbox />
        </v-list-tile-action>
        <v-list-tile-content>
          <v-list-tile-title>Sound</v-list-tile-title>
          <v-list-tile-sub-title>Auto-update apps at any time. Data charges may apply</v-list-tile-sub-title>
        </v-list-tile-content>
      </v-list-tile>
      <v-list-tile avatar>
        <v-list-tile-action>
          <v-checkbox />
        </v-list-tile-action>
        <v-list-tile-content>
          <v-list-tile-title>Auto-add widgets</v-list-tile-title>
          <v-list-tile-sub-title>Automatically add home screen widgets</v-list-tile-sub-title>
        </v-list-tile-content>
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
