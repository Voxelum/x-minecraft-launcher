<template>
  <v-dialog :value="value" :width="600" @input="$emit('input', $event)">
    <v-toolbar color="orange">
      <v-toolbar-title class="white--text">
        {{ $t('profile.logsCrashes.title') }}
      </v-toolbar-title>

      <v-spacer />
      <v-toolbar-items>
        <v-btn flat :diabled="loadingList" @click="goLog">
          {{ $t('profile.logsCrashes.logs') }}
        </v-btn>
        <v-btn flat :diabled="loadingList" @click="goCrash">
          {{ $t('profile.logsCrashes.crashes') }}
        </v-btn>
      </v-toolbar-items>
    </v-toolbar>
    <v-card style="min-height: 450px; max-height: 450px; overflow: auto">
      <transition name="fade-transition" mode="out-in">
        <v-list v-if="!content" :key="0">
          <v-list-tile v-for="i in files" :key="i" v-ripple avatar @click="showFile(i)">
            <v-list-tile-avatar>
              <v-icon>
                call_to_action
              </v-icon>
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>{{ i }}</v-list-tile-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-list-tile-action>
                <v-btn icon color="red" flat>
                  <v-icon>delete</v-icon>
                </v-btn>
              </v-list-tile-action>
            </v-list-tile-action>
          </v-list-tile>
        </v-list>
        <div v-else :key="1">
          <v-card-title primary-title>
            {{ showedFile }}
            <v-spacer />
            <v-btn flat @click="goBack">
              <v-icon left>
                arrow_back
              </v-icon>
              Back
            </v-btn>
          </v-card-title>
          <v-textarea 
            auto-grow
            autofocus
            box
            readonly
            no-resize
            hide-details
            :value="content" style="margin: 8px;" />
        </div>
      </transition>
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
      showCrash: false,

      loadingContent: false,
      loadingList: false,
      showedFile: '',
      files: [],

      content: '',
    };
  },
  watch: {
    value() {
      this.loadLogs();
    },
  },
  methods: {
    loadLogs() {
      this.loadingList = true;
      this.$repo.dispatch('listLogs').then((l) => {
        this.files = l;
      }).finally(() => {
        this.loadingList = false;
      });
    },
    loadCrashes() {
      this.loadingList = true;
      this.$repo.dispatch('listCrashes').then((l) => {
        this.files = l;
      }).finally(() => {
        this.loadingList = false;
      });
    },
    removeFile(i) {
    },
    showFile(i) {
      const name = i;
      if (name !== this.showedFile) {
        this.loadingContent = true;
        this.showedFile = name;
        if (this.showCrash) {
          this.$repo.dispatch('getLogContent', name)
            .then((c) => {
              this.content = c;
            }).finally(() => {
              this.loadingContent = false;
            });
        } else {
          this.$repo.dispatch('getLogContent', name)
            .then((c) => {
              this.content = c;
            }).finally(() => {
              this.loadingContent = false;
            });
        }
      }
    },
    goBack() {
      this.content = '';
    },
    goLog() {
      this.showCrash = false;
      this.content = '';
      this.loadLogs();
    },
    goCrash() {
      this.showCrash = true;
      this.content = '';
      this.loadCrashes();
    },
  },
};
</script>

<style>
</style>
