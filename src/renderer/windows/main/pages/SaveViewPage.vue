<template>
  <v-container grid-list-xs fill-height style="overflow: auto;">
    <v-layout row wrap align-start>
      <v-flex tag="h1" class="white--text" style="z-index: 1">
        <span class="headline">{{ $tc('save.name', 2) }}</span>
      </v-flex>
      <v-flex shrink style="z-index: 1">
        <v-btn flat @click="doCopyFrom">
          <v-icon left>
            input
          </v-icon>
          {{ $t('save.copyFrom.title') }}
        </v-btn>
      </v-flex>
      <v-flex shrink style="z-index: 1">
        <v-btn flat @click="doImport">
          <v-icon left>
            move_to_inbox
          </v-icon>
          {{ $t('save.import') }}
        </v-btn>
      </v-flex>
      <v-flex xs12 @drop.prevent="onDrop" @dragover.prevent>
        <hint v-if="saves.length === 0" :absolute="true" icon="map" :text="$t('save.hint')" />
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
                  <v-btn color="red" flat @click="startDelete(s.name)"> 
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
                  <v-btn flat @click="doExport(s.name)">
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
    <!-- <dialog-copy-save-from v-model="copyFrom" /> -->
    <v-dialog :value="copying !== ''" width="500">
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

        <v-card-text>
          <v-checkbox v-for="(p, index) of instances" :key="index"
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
    <v-dialog :value="deleting !== ''" width="500">
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

<script lang="ts">
import { createComponent, reactive, toRefs } from '@vue/composition-api';
import unknown from '@/assets/unknown_pack.png';
import {
  useInstanceSaves,
  useNativeDialog,
  useI18n,
  useInstances,
} from '@/hooks';

export default createComponent({
  setup() {
    const { saves, deleteSave, importSave, exportSave, cloneSave: copySave } = useInstanceSaves();
    const { instances } = useInstances();
    const { showSaveDialog, showOpenDialog } = useNativeDialog();
    const { $t } = useI18n();
    const data = reactive({
      copyFrom: false,

      copying: '',
      copyingDest: [] as string[],

      deleting: '',
    });
    return {
      saves,
      instances,
      ...toRefs(data),

      unknown,
      onDrop(event: DragEvent) {
        const length = event.dataTransfer!.files.length;
        if (length > 0) {
          for (let i = 0; i < length; ++i) {
            const file = event.dataTransfer!.files[i];
            importSave({ source: file.path });
          }
        }
      },

      startDelete(p: string) {
        data.deleting = p;
      },
      doDelete() {
        deleteSave({ saveName: data.deleting });
        data.deleting = '';
      },
      cancelDelete() {
        data.deleting = '';
      },

      startCopy(name: string) {
        data.copying = name;
        data.copyingDest = new Array(instances.value.length);
      },
      doCopy() {
        let dests = instances
          .value
          .filter((p, index) => data.copyingDest[index])
          .map(p => p.path);
        copySave({ saveName: data.copying, destInstancePath: dests });
      },
      cancelCopy() {
        data.copying = '';
      },

      async doImport() {
        const { filePaths } = await showOpenDialog({
          title: $t('save.importTitle'),
          message: $t('save.importMessage'),
          filters: [{ extensions: ['zip'], name: 'zip' }],
        });
        for (const file of filePaths) {
          importSave({ source: file });
        }
      },
      async doExport(name: string) {
        const { filePath } = await showSaveDialog({
          title: $t('save.exportTitle'),
          message: $t('save.exportMessage'),
          filters: [{ extensions: ['zip'], name: 'zip' }],
        });
        if (filePath) {
          exportSave({ destination: filePath, zip: true, saveName: name });
        }
      },

      doCopyFrom() {
        data.copyFrom = true;
      },
    };
  },
});
</script>

<style>
</style>
