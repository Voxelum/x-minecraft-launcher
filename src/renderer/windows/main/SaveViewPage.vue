<template>
  <v-container grid-list-xs fill-height style="overflow: auto;">
    <v-layout row wrap>
      <v-flex tag="h1" class="white--text" xs9>
        <span class="headline">{{ $tc('save.name', 2) }}</span>
      </v-flex>
      <v-flex shrink>
        <v-btn flat @click="doCopyTo">
          <v-icon left>
            input
          </v-icon>
          {{ $t('save.copyTo') }}
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
      <v-flex xs12 fill-height @drop="onDrop" @dragover="onDragOver">
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
        <v-card v-for="(s, index) of saves" v-else :key="index" flat hover class="white--text">
          <v-layout>
            <v-flex xs3 pa-3>
              <v-img
                :src="s.icon"
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
          <v-card-actions class="pa-3">
            <v-btn color="red" flat @click="startDelete(s.path)"> 
              <v-icon left>
                delete
              </v-icon>
              {{ $t('save.deleteTitle') }}
            </v-btn>
            <v-spacer />
            <v-btn flat @click="startCopy(s.path)">
              {{ $t('save.copy') }}
            </v-btn>


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
    <v-dialog v-model="copyingTo" width="500">
      <v-card>
        <v-card-title
          class="headline"
          primary-title
        >
          {{ $t('save.copyTo.title') }}
        </v-card-title>
        <v-card-text>
          {{ $t('save.copyTo.description') }}
        </v-card-text>

        <v-card-text v-if="copyingItem">
          <v-treeview :items="otherProfilesMaps"></v-treeview>
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
export default {
  data() {
    return {
      saves: [],

      copyingTo: false,

      copyingItem: false,
      copying: '',
      copyingDest: [],

      deletingItem: false,
      deleting: '',
    };
  },
  computed: {
    profiles() {
      return this.$repo.getters.profiles.filter(p => p.id !== this.$repo.state.profile.id);
    },
  },
  mounted() {
    this.load();
  },
  methods: {
    onDragOver(event) { event.preventDefault(); return false; },
    onDrop(event) {
      event.preventDefault();
      const length = event.dataTransfer.files.length;
      if (length > 0) {
        for (let i = 0; i < length; ++i) {
          const file = event.dataTransfer.files[i];
          this.$repo.dispatch('importSave', file);
        }
      }
    },
    async load() {
      const saves = await this.$repo.dispatch('loadProfileSaves');
      this.saves = saves;
    },
    doCopyTo() {
    },
    doImport() {
      this.$electron.remote.dialog.showOpenDialog({
        title: this.$t('save.importTitle'),
        message: this.$t('save.importMessage'),
        filters: [{ extensions: ['zip'], name: 'zip' }],
      }, (filename, bookmark) => {
        if (filename) {
          for (const file of filename) {
            this.$repo.dispatch('importSave', filename).then((suc) => {
              this.$notify('success', 'Import Map');
            });
          }
        }
      });
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
      this.$repo.dispatch('deleteSave', this.deleting)
        .then(() => {
          this.$notify('success', 'Delete Map');
        }).catch((e) => {
          this.$notify('failed', 'Delete Map');
        }).finally(() => {
          this.deletingItem = false;
          this.deleting = '';
        });
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
