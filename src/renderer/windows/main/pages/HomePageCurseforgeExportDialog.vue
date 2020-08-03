<template>
  <v-dialog
    :value="value"
    width="600"
    @input="$emit('input', $event)"
  >
    <v-card>
      <v-toolbar
        dark
        tabs
        color="green darken"
      >
        <v-toolbar-title>{{ $t('profile.modpack.exportCurseforge') }}</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          @click="$emit('input', false)"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <v-container grid-list-sm>
        <v-subheader>{{ $t('profile.modpack.general') }}</v-subheader>
        <v-container
          grid-list-md
          style="padding-top: 0px"
        >
          <v-layout row>
            <v-flex d-flex>
              <v-text-field
                v-model="name"
                dark
                persistent-hint
                :hint="$t('profile.nameHint')"
                required
              />
            </v-flex>
            <v-flex d-flex>
              <v-text-field
                v-model="author"
                dark
                persistent-hint
                :hint="$t('profile.authorHint')"
                :label="$t('author')"
                required
              />
            </v-flex>
          </v-layout>
          <v-layout row>
            <v-flex d-flex>
              <v-text-field
                v-model="version"
                dark
                persistent-hint
                :hint="$t('profile.instanceVersion')"
                :label="$t('version')"
                required
              />
            </v-flex>
            <v-flex
              d-flex
              xs6
            >
              <v-select
                v-model="gameVersion"
                :items="localVersions"
                dark
                persistent-hint
                :hint="$t('profile.version')"
                :label="$t('version')"
                required
              />
            </v-flex>
          </v-layout>
        </v-container>
        <v-layout>
          <v-subheader>{{ $t('profile.modpack.overrides') }}</v-subheader>
        </v-layout>
        <v-layout
          row
          style="padding: 5px; margin-bottom: 5px;"
        >
          <v-treeview
            v-model="selected"
            style="width: 100%"
            :items="files"
            :open="opened"
            selectable
            hoverable
            activatable
            transition
            open-on-click
            item-children="children"
          >
            <template v-slot:prepend="{ item, open, leaf, selected }">
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
                >{{ item.name }} </span>
                <div
                  style="color: grey; font-size: 12px; font-style: italic; max-width: 300px;"
                >
                  {{ item.description }}
                </div>
              </div>
            </template>
          </v-treeview>
        </v-layout>
        <v-layout row>
          <v-btn
            flat
            large
            @click="cancel"
          >
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn
            flat
            color="primary"
            large
            @click="confirm"
          >
            {{ $t('profile.modpack.export') }}
          </v-btn>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, toRefs, computed, onMounted, defineComponent, Ref, ref, onUnmounted, watch } from '@vue/composition-api';
import { useInstance, useService, useI18n, useVersions, useLocalVersions, useNativeDialog, useInstanceVersion } from '@/hooks';
import { useZipFilter } from '../hooks';

interface Props {
  value: boolean;
}

export default defineComponent<Props>({
  props: {
    value: Boolean,
  },
  setup(props, context) {
    const { name, author } = useInstance();
    const { getInstanceFiles, exportCurseforge } = useService('InstanceIOService');
    const { showSaveDialog } = useNativeDialog();
    const { localVersions } = useLocalVersions();
    const { folder } = useInstanceVersion();
    const { $t } = useI18n();
    const data = reactive({
      name: name.value,
      author: author.value,
      version: '0.0.0',
      gameVersion: '',
      files: [] as readonly FileNode[],
      opened: [],
      selected: [] as string[],
      refreshing: false,
      exporting: false,
    });
    let cachedFiles: { path: string; isDirectory: boolean; isResource: boolean }[] = [];
    interface FileNode {
      name: string;
      id: string;
      description: string;
      disabled?: boolean;
      children?: FileNode[];
    }
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
    function reset() {
      data.selected = [];
      data.opened = [];
      data.gameVersion = folder.value ? folder.value : '';
    }
    function refresh() {
      data.refreshing = true;
      getInstanceFiles().then((files) => {
        cachedFiles = files;
        data.files = Object.freeze(buildTree(files));
        data.selected = files.filter(p => p.path.startsWith('config') || p.path.startsWith('mods')).map(p => p.path);
      }).finally(() => { data.refreshing = false; });
    }
    function cancel() {
      context.emit('input', false);
    }
    const zipFilter = useZipFilter();
    async function confirm() {
      data.exporting = true;
      const overrides = data.selected.filter(p => !!cachedFiles.find(f => f.path === p && !f.isDirectory));
      const { filePath } = await showSaveDialog({
        title: $t('profile.modpack.export'),
        defaultPath: `${data.name}-${data.version}`,
        filters: [zipFilter],
      });
      if (filePath) {
        try {
          await exportCurseforge({
            overrides,
            name: data.name,
            author: data.author,
            version: data.version,
            gameVersion: data.gameVersion,
            destinationPath: filePath,
          });
        } catch (e) {
          console.error(e);
        }
      }
      data.exporting = false;
    }
    watch(() => props.value, () => {
      if (props.value) {
        reset();
        refresh();
      }
    });
    return {
      localVersions: computed(() => localVersions.value.map((v) => v.folder)),
      ...toRefs(data),
      cancel,
      confirm,
      refresh,
    };
  },
});
</script>

<style>
</style>
