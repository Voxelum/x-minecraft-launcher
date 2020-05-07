<template>
  <v-list
    v-if="versions.length !== 0"
    dark
    style="overflow-y: scroll; scrollbar-width: 0; background-color: transparent;"
  >
    <template v-for="(item) in versions">
      <v-list-tile
        :key="item.id"
        ripple
        :class="{ grey: isSelected(item), 'darken-1': isSelected(item) }"
        style="margin: 0px 0;"
        @click="selectVersion(item)"
      >
        <v-list-tile-avatar>
          <v-btn icon style="cursor: pointer" @click.stop="openVersionDir(item)">
            <v-icon>folder</v-icon>
          </v-btn>
        </v-list-tile-avatar>
        <v-list-tile-title>{{ item.folder }}</v-list-tile-title>
        <v-list-tile-sub-title>{{ item.minecraft }}</v-list-tile-sub-title>
        <v-list-tile-action style="justify-content: flex-end;">
          <v-btn
            style="cursor: pointer"
            icon
            color="red"
            flat
            @mousedown.stop
            @click.stop="startDelete(item)"
          >
            <v-icon>delete</v-icon>
          </v-btn>
        </v-list-tile-action>
      </v-list-tile>
    </template>
    <v-dialog v-model="deletingVersion" max-width="290">
      <v-card dark>
        <v-card-title class="headline">{{ $t('version.deleteTitle') }}</v-card-title>
        <v-card-text>{{ $t('version.deleteDescription') }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn flat @click="cancelDeleting()">{{ $t('no') }}</v-btn>
          <v-btn color="red darken-1" flat @click="comfireDeleting()">{{ $t('yes') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-list>
  <v-container v-else fill-height>
    <v-layout align-center justify-center row fill-height>
      <v-flex shrink tag="h1" class="white--text">
        <v-btn large color="primary" @click="browseVersoinsFolder">
          <v-icon left>folder</v-icon>
          {{ $t('version.noLocalVersion') }}
        </v-btn>
        <v-btn large color="primary" @click="refreshVersions">
          <v-icon left>refresh</v-icon>
          {{ $t('version.refresh') }}
        </v-btn>
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { defineComponent, reactive, computed, toRefs } from '@vue/composition-api';
import { useLocalVersions } from '@/hooks';
import { LocalVersion } from '../../../../universal/store/modules/version';

export default defineComponent({
  props: {
    filterText: {
      type: String,
      default: '',
    },
    value: {
      type: Object,
      default: () => { },
    },
  },
  setup(props, context) {
    const data = reactive({
      deletingVersion: false,
      deletingVersionId: '',
    });
    const { localVersions, deleteVersion, showVersionsDirectory, showVersionDirectory, refreshVersions } = useLocalVersions();
    const versions = computed(() => localVersions.value.filter(v => v.folder.indexOf(props.filterText) !== -1));

    function isSelected(v: LocalVersion) {
      if (!props.value) return false;
      return props.value.minecraft === v.minecraft
        && props.value.forge === v.forge
        && props.value.liteloader === v.liteloader
        && props.value.yarn === v.yarn
        && props.value.fabricLoader === v.fabricLoader;
    }
    function selectVersion(v: LocalVersion) {
      context.emit('input', v);
    }
    function browseVersoinsFolder() {
      showVersionsDirectory();
    }
    function openVersionDir(v: { folder: string }) {
      showVersionDirectory(v.folder);
    }
    function startDelete(v: { folder: string }) {
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
      ...toRefs(data),
      versions,
      isSelected,
      cancelDeleting,
      comfireDeleting,
      startDelete,
      openVersionDir,
      browseVersoinsFolder,
      refreshVersions,
      selectVersion,
    };
  },
});
</script>

<style>
</style>
