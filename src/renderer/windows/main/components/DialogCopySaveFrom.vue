<template>
  <v-dialog :value="value" width="500" persistent @input="$emit('input', $event)">
    <v-card>
      <v-card-title
        class="headline"
        primary-title
      >
        {{ $t('save.copyFrom.title') }}
      </v-card-title>
      <v-card-text>
        {{ $t('save.copyFrom.description') }}
      </v-card-text>

      
      <v-alert :value="error !== null" type="error">
        {{ error }}
      </v-alert>


      <v-list two-line>
        <v-subheader v-if="storedSaves.length">
          {{ $t('save.copyFrom.fromResource') }}
        </v-subheader>

        <v-list-tile v-for="(s, i) in storedSaves" :key="s.hash">
          <v-list-tile-action>
            <v-checkbox v-model="resourcesCopyFrom[i]" />
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title> {{ s.name }} </v-list-tile-title>
            <v-list-tile-sub-title> {{ $t('save.copyFrom.from', {src:s.source.curseforge ? 'curseforge' : 'resources'}) }} </v-list-tile-sub-title>
          </v-list-tile-content>
        </v-list-tile>

        <v-subheader v-if="loadedProfileSaves.length !== 0">
          {{ $t('save.copyFrom.fromProfile') }}
        </v-subheader>

        <v-progress-circular v-if="loadedProfileSaves.length === 0 && loadingSaves" indeterminate />
        <v-list-tile v-for="(s, i) in loadedProfileSaves" :key="s.path">
          <v-list-tile-action>
            <v-checkbox v-model="profilesCopyFrom[i]" />
          </v-list-tile-action>
          <v-list-tile-content>
            <v-list-tile-title> {{ s.level.LevelName }} </v-list-tile-title>
            <v-list-tile-sub-title> {{ $t('save.copyFrom.from', {src: s.profile}) }} </v-list-tile-sub-title>
          </v-list-tile-content>
        </v-list-tile>
      </v-list>
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          :disabled="working"
          color="red"
          flat
          @click="$emit('input', false)"
        >
          {{ $t('save.copyFrom.cancel') }}
        </v-btn>
        <v-btn
          :disabled="nothingSelected"
          :loading="working"
          color="primary"
          flat
          @click="startImport"
        >
          {{ $t('save.copyFrom.confirm') }}
        </v-btn>
      </v-card-actions>
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
      loadingSaves: false,
      loadedProfileSaves: [],

      profilesCopyFrom: [],
      resourcesCopyFrom: [],

      working: false,

      error: null,
    };
  },
  computed: {
    nothingSelected() {
      return this.profilesCopyFrom.every(v => !v) && this.resourcesCopyFrom.every(v => !v);
    },
    storedSaves() {
      return this.$repo.getters.saves;
    },
  },
  watch: {
    loadedProfileSaves() {
      this.profilesCopyFrom = new Array(this.loadedProfileSaves.length);
    },
    storedSaves() {
      this.resourcesCopyFrom = new Array(this.storedSaves.length);
    },
    value() {
      if (this.value) {
        this.loadingSaves = true;
        this.$repo.dispatch('loadAllProfileSaves')
          .then((r) => { this.loadedProfileSaves = r.filter(s => s !== undefined); })
          .finally(() => { this.loadingSaves = false; });
      }
    },
  },
  methods: {
    async startImport() {
      this.working = true;
      try {
        const profilesSaves = this.loadedProfileSaves.filter((_, i) => this.profilesCopyFrom[i]);
        const resourcesSaves = this.storedSaves.filter((_, i) => this.resourcesCopyFrom[i]);

        if (resourcesSaves.length !== 0) {
          await this.$repo.dispatch('deployResources', {
            resourceUrls: resourcesSaves.map(r => r.hash),
            profile: this.$repo.state.profile.id,
          });
        }

        if (profilesSaves.length !== 0) {
          for (const s of profilesSaves) {
            await this.$repo.dispatch('copySave', { src: s.profile, dest: this.$repo.state.profile.id });
          }
        }

        this.$emit('input', false);
      } catch (e) {
        this.error = e;
        console.error('Fail to copy saves');
        console.error(e);
      } finally {
        this.working = false;
      }
    },
  },
};
</script>

<style>
</style>
