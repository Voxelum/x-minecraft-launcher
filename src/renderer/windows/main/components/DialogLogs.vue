<template>
  <v-dialog :value="value" :width="550" @input="$emit('input', $event)">
    <v-toolbar color="warning">
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
    <transition name="fade-transition" mode="out-in">
      <div style="min-height: 450px; max-height: 450px; overflow: auto; background: #424242">
        <v-list v-if="!content" :key="0">
          <v-list-tile v-for="i in files" :key="i" v-ripple avatar @click="showFile(i)">
            <v-list-tile-avatar>
              <v-icon>
                clear_all
              </v-icon>
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>{{ i }}</v-list-tile-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-list-tile-action>
                <v-btn icon color="red" flat @click="removeFile($event, i)">
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
              {{ $t('back') }}
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
      </div>
    </transition>
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
    removeFile(event, i) {
      if (this.showCrash) {
        this.$repo.dispatch('removeCrashReport', i);
        this.loadCrashes();
      } else {
        this.$repo.dispatch('removeLog', i);
        this.loadLogs();
      }
      event.preventDefault();
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
