<template>
  <v-container grid-list-xs fill-height style="overflow: auto;">
    <v-layout row wrap align-start>
      <v-flex tag="h1" class="white--text">
        <span class="headline">{{ $tc('save.name', 2) }}</span>
      </v-flex>
      <v-flex shrink>
        <v-btn flat @click="doCopyFrom">
          <v-icon left>
            input
          </v-icon>
          {{ $t('save.copyFrom.title') }}
        </v-btn>
      </v-flex>
      <v-flex shrink>
        <v-btn flat @click="doImport">
          <v-icon left>
            move_to_inbox
          </v-icon>
          {{ $t('save.import') }}
        </v-btn>
      </v-flex>
      <v-flex xs12 @drop.prevent="onDrop" @dragover.prevent>
        <v-container v-if="saves.length === 0" fill-height>
          <v-layout fill-height align-center justify-center column>
            <v-flex shrink>
              <p class="text-xs-center headline">
                <v-icon style="font-size: 50px; display: block;">
                  map
                </v-icon>
                {{ $t('save.hint') }}
              </p>
            </v-flex>
          </v-layout>
        </v-container>
        <v-container v-else style="overflow-y: auto; max-height: 80vh" grid-list-md>
          <v-layout row wrap>
            <v-flex v-for="(s, index) of saves" :key="index">
              <v-card flat hover class="white--text">
                <v-layout>
                  <v-flex xs3>
                    <v-img
                      :src="s.icon || unknown"
                      height="125"
                      contain
                    />
                  </v-flex>
                  <v-flex>
                    <v-card-title primary-title>
                      <div>
                        <div class="headline">
                          {{ s.level.LevelName }}
                        </div>

                        <div>{{ $t(`gamesetting.gametype.${s.level.GameType}`) }}</div>
                        <div>{{ new Date(s.level.LastPlayed * 1).toLocaleString() }}</div>
                      </div>
                    </v-card-title>
                  </v-flex>
                </v-layout>
                <v-divider light />
                <v-card-actions>
                  <v-btn color="red" flat @click="startDelete(s.path)"> 
                    <v-icon left>
                      delete
                    </v-icon>
                    {{ $t('save.deleteTitle') }}
                  </v-btn>
                  <v-spacer />
                  <!-- <v-btn flat @click="showDetail">
              <v-icon left>
                map
              </v-icon>
              {{ $t('save.detail') }}
            </v-btn> -->
                  <v-btn flat @click="doExport(s.path)">
                    <v-icon left>
                      launch
                    </v-icon>
                    {{ $t('save.export') }}
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-flex>
          </v-layout>
        </v-container>
      </v-flex>
    </v-layout>
    <dialog-copy-save-from v-model="copyFrom" @import="importSave" />
    <v-dialog v-model="copyingItem" width="500">
      <v-card>
        <v-card-title
          class="headline"
          primary-title
        >
          {{ $t('save.copy.title') }}
        </v-card-title>
        <v-card-text>
          {{ $t('save.copy.description') }}
        </v-card-text>

        <v-card-text v-if="copyingItem">
          <v-checkbox v-for="(p, index) of profiles" :key="index"
                      v-model="copyingDest[index]"
                      hide-details
                      :label="p.name"
          />
        </v-card-text>

        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="red"
            flat
            @click="cancelCopy"
          >
            {{ $t('save.copy.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            flat
            @click="doCopy"
          >
            {{ $t('save.copy.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="deletingItem" width="500">
      <v-card>
        <v-card-title
          class="headline"
          primary-title
        >
          {{ $t('save.deleteTitle') }}
        </v-card-title>

        <v-card-text>
          {{ $t('save.deleteHint') }}
        </v-card-text>

        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="red"
            flat
            @click="cancelDelete"
          >
            {{ $t('save.deleteCancel') }}
          </v-btn>
          <v-btn
            color="primary"
            flat
            @click="doDelete"
          >
            {{ $t('save.deleteConfirm') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import unknown from 'renderer/assets/unknown_pack.png';

export default {
  data() {
    return {
      copyFrom: false,

      copyingItem: false,
      copying: '',
      copyingDest: [],

      deletingItem: false,
      deleting: '',

      unknown,
    };
  },
  computed: {
    saves() { return this.$repo.state.profile.saves; },
    profiles() {
      return this.$repo.getters.profiles.filter(p => p.id !== this.$repo.state.profile.id);
    },
  },
  mounted() {
  },
  methods: {
    onDrop(event) {
      const length = event.dataTransfer.files.length;
      if (length > 0) {
        for (let i = 0; i < length; ++i) {
          const file = event.dataTransfer.files[i];
          this.$repo.dispatch('importSave', file);
        }
      }
    },
    async load() {
      await this.$repo.dispatch('loadProfileSaves');
    },
    doCopyFrom() {
      this.copyFrom = true;
    },
    doImport() {
      this.$electron.remote.dialog.showOpenDialog({
        title: this.$t('save.importTitle'),
        message: this.$t('save.importMessage'),
        filters: [{ extensions: ['zip'], name: 'zip' }],
      }, (filename, bookmark) => {
        if (filename) {
          for (const file of filename) {
            this.$repo.dispatch('executeAction', { action: 'importSave', payload: file });
          }
        }
      });
    },
    importSave({ curseforge }) {

    },
    startCopy(path) {
      this.copyingItem = true;
      this.copying = path;
      this.copyingDest = new Array(this.profiles.length);
    },
    doCopy() {
      const dests = this.profiles.filter((p, index) => this.copyingDest[index]).map(p => p.id);
      this.$repo.dispatch('copySave', { src: this.copying, dest: dests });
    },
    cancelCopy() {
      this.copyingItem = false;
      this.copying = '';
    },
    doDelete() {
      this.$repo.dispatch('executeAction', { action: 'deleteSave', payload: this.deleting });
      this.deletingItem = false;
      this.deleting = '';
    },
    cancelDelete() {
      this.deletingItem = false;
      this.deleting = '';
    },
    startDelete(p) {
      this.deletingItem = true;
      this.deleting = p;
    },
    showDetail() {

    },
    doExport(path) {
      this.$electron.remote.dialog.showSaveDialog({
        title: this.$t('save.exportTitle'),
        message: this.$t('save.exportMessage'),
        filters: [{ extensions: ['zip'], name: 'zip' }],
      }, (filename, bookmark) => {
        if (filename) {
          this.$repo.dispatch('exportSave', {
            destination: filename,
            zip: true,
            path,
          }).then();
        }
      });
    },
  },
};
</script>

<style>
</style>
