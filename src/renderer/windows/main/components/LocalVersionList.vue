<template>
  <v-list v-if="versions.length !== 0" dark style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent;">
    <template v-for="(item, index) in versions">
      <v-list-tile :key="index" ripple :class="{ grey: isSelected(item), 'darken-1': isSelected(item) }" style="margin: 0px 0;" @click="selectVersion(item)">
        <v-list-tile-avatar>
          <v-btn icon style="cursor: pointer" @click.stop="openVersionDir(item)">
            <v-icon> folder </v-icon>
          </v-btn>
        </v-list-tile-avatar>
        <v-list-tile-title>
          {{ item.folder }}
        </v-list-tile-title>
        <v-list-tile-sub-title>
          {{ item.minecraft }}
        </v-list-tile-sub-title>
        <v-list-tile-action style="justify-content: flex-end;">
          <v-btn style="cursor: pointer" icon color="red"
                 flat @mousedown.stop @click.stop="startDelete(item)">
            <v-icon>delete</v-icon>
          </v-btn>
        </v-list-tile-action>
      </v-list-tile>
    </template>
    <v-dialog v-model="deletingVersion" max-width="290">
      <v-card dark>
        <v-card-title class="headline">
          {{ $t('version.deleteTitle') }}
        </v-card-title>
        <v-card-text>
          {{ $t('version.deleteDescription') }}
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn flat @click="cancelDeleting()">
            {{ $t('no') }}
          </v-btn>
          <v-btn color="red darken-1" flat @click="comfireDeleting()">
            {{ $t('yes') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-list>
  <v-container v-else fill-height>
    <v-layout align-center justify-center row fill-height>
      <v-flex shrink tag="h1" class="white--text">
        <v-btn large>
          <v-icon left @click="browseVersoinsFolder">
            folder
          </v-icon>
          {{ $t('version.noLocalVersion') }}
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script>
import { createComponent, reactive, computed } from '@vue/composition-api';
import { useLocalVersions, useCurrentProfile } from '@/hooks';

export default createComponent({
  props: {
    filterText: {
      type: String,
      default: '',
    },
  },
  setup(props) {
    const data = reactive({
      deletingVersion: false,
      deletingVersionId: '',
    });
    const { localVersions, deleteVersion } = useLocalVersions();
    const { version, edit } = useCurrentProfile();
    const selected = computed(() => localVersions.value.find(v => v.minecraft === version.value.minecraft && v.forge === version.value.forge && v.liteloader === version.value.liteloader));
    const versions = computed(() => localVersions.value.filter(v => v.id.indexOf(props.filterText) !== -1));

    function isSelected(v) {
      if (!selected.selected) return false;
      return selected.value.minecraft === v.minecraft && selected.value.forge === v.forge && selected.value.liteloader === v.liteloader;
    }
    function selectVersion(v) {
      edit({ version: v });
    }
    function browseVersoinsFolder() {
      // this.$repo.dispatch('showVersionsDirectory');
    }
    function openVersionDir(event, v) {
      // this.$repo.dispatch('showVersionDirectory', v.folder);
    }
    function startDelete(event, v) {
      data.deletingVersion = true;
      data.deletingVersionId = v.folder;
    }
    function comfireDeleting() {
      deleteVersion(data.deletingVersionId);
      data.deletingVersion = false;
      data.deletingVersionId = '';
    }
    function cancelDeleting() {
      data.deletingVersion = false;
      data.deletingVersionId = '';
    }

    return {
      versions,
    };
  },
});
</script>

<style>
</style>
