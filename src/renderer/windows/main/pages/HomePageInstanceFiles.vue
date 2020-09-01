<template>
  <v-treeview
    :value="value"
    style="width: 100%"
    :items="files"
    :open="opened"
    selectable
    hoverable
    activatable
    transition
    open-on-click
    item-children="children"
    @input="$emit('input', $event)"
  >
    <template v-slot:prepend="{ item, open, selected }">
      <v-icon
        v-if="item.children"
        :color="selected ? 'accent' : ''"
      >
        {{ open ? 'folder_open' : 'folder' }}
      </v-icon>
      <v-icon v-else>insert_drive_file</v-icon>
    </template>

    <template v-slot:label="{ item }">
      <div style="padding: 5px 0px;">
        <span
          style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;"
          :style="{ color: item.disabled ? 'grey' : 'white' }"
        >{{ item.name }}</span>
        <div
          style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
        >
          {{ item.description }}
        </div>
      </div>
    </template>
  </v-treeview>
</template>

<script lang=ts>
import { reactive, toRefs, computed, onMounted, defineComponent, Ref, ref, onUnmounted, watch } from '@vue/composition-api';
import { useInstance, useService, useI18n, useVersions, useLocalVersions, useNativeDialog, useInstanceVersion } from '@/hooks';
import { InstanceFile } from '@main/service/InstanceIOService';
import { useZipFilter } from '../hooks';

interface Props {
  items: InstanceFile[];
  value: string[];
}

interface FileNode {
  name: string;
  id: string;
  description: string;
  disabled?: boolean;
  children?: FileNode[];
}

export default defineComponent<Props>({
  props: {
    items: Array,
    value: Array,
  },
  setup(props, context) {
    const { $t } = useI18n();
    const data = reactive({
      opened: [],
      files: [] as readonly FileNode[],
    });
    function getDescription(path: string, isResource: boolean) {
      switch (path) {
        case 'mods':
          return $t('intro.struct.mods');
        case 'resourcepacks':
          return $t('intro.struct.resourcepacks');
        case 'config':
          return $t('intro.struct.config');
        case 'saves':
          return $t('intro.struct.saves');
        case 'options.txt':
          return $t('intro.struct.optionTxt');
        case 'logs':
          return $t('intro.struct.logs');
        default:
      }
      if (path.startsWith('mods/')) {
        return isResource ? $t('intro.struct.modManaged') : $t('intro.struct.modJar');
      }
      return '';
    }
    function ensureFile(cwd: FileNode[], filePaths: string[], used: string[], isDir: boolean, isRes: boolean) {
      let path = filePaths[0];
      let cur = cwd.find(n => n.name === path);
      let next = [...used, path];
      if (!cur) {
        cur = { name: path, id: next.join('/'), description: getDescription(next.join('/'), isRes) };
        cwd.push(cur);
      }
      let remained = filePaths.slice(1);
      if (remained.length > 0) {
        if (!cur.children) {
          cur.children = [];
        }
        ensureFile(cur.children, remained, next, isDir, isRes);
      } else if (isDir) {
        cur.children = cur.children ?? [];
      } else {
        cur.disabled = isRes;
      }
    }
    function buildTree(files: { path: string; isDirectory: boolean; isResource: boolean }[]) {
      let result: FileNode[] = [];
      for (let file of files) {
        ensureFile(result, file.path.split('/'), [], file.isDirectory, file.isResource);
      }
      return result;
    }
    watch(() => props.items, () => {
      data.files = Object.freeze(buildTree(props.items));
      data.opened = [];
    });
    return {
      ...toRefs(data),
    };
  },
});
</script>

<style>
</style>
