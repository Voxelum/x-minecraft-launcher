<template>
  <v-container
    grid-list-xs
    fill-height
    style=" overflow: auto;"
  >
    <v-layout
      row
      wrap
      justify-start
      align-content-start
    >
      <v-flex
        tag="h1"
        class="white--text"
        xs12
      >
        <span class="headline">{{ $t('profile.launchingDetail') }}</span>
      </v-flex>
      <v-flex xs12>
        <v-list
          three-line
          subheader
          style="background: transparent; width: 100%"
        >
          <v-subheader style="padding-right: 2px">
            Java
            <v-spacer />
            <v-tooltip left>
              <template v-slot:activator="{ on }">
                <v-btn
                  icon
                  :loading="refreshingLocalJava"
                  v-on="on"
                  @click="refreshLocalJava"
                >
                  <v-icon>refresh</v-icon>
                </v-btn>
              </template>
              {{ $t('java.refresh') }}
            </v-tooltip>
            <v-tooltip left>
              <template v-slot:activator="{ on }">
                <v-btn
                  icon
                  @click="browseFile"
                  v-on="on"
                >
                  <v-icon>add</v-icon>
                </v-btn>
              </template>
              {{ $t('java.browser') }}
            </v-tooltip>
          </v-subheader>
          <v-list-group no-action>
            <template v-slot:activator>
              <v-list-tile>
                <v-list-tile-content>
                  <v-list-tile-title>{{ $t('java.location') }}</v-list-tile-title>
                  <v-list-tile-sub-title>{{ java ? java.path : $t('java.locationPlaceHolder') }}</v-list-tile-sub-title>
                </v-list-tile-content>
              </v-list-tile>
            </template>
            <java-list
              v-model="java"
              :items="javas"
              :remove="removeJava"
            />
          </v-list-group>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('java.memory') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ $t('java.memoryHint') }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action style="width: 25%; margin-right: 10px">
              <v-text-field
                v-model="minMemory"
                hide-details
                type="number"
                required
                clearable
                :label="$t('java.minMemory')"
                :placeholder="$t('java.noMemory')"
              />
            </v-list-tile-action>
            <v-list-tile-action style="width: 25%">
              <v-text-field
                v-model="maxMemory"
                hide-details
                type="number"
                required
                clearable
                :label="$t('java.maxMemory')"
                :placeholder="$t('java.noMemory')"
              />
            </v-list-tile-action>
          </v-list-tile>
          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('profile.vmOptions') }}</v-list-tile-title>
              <v-list-tile-sub-title style="height: 50px;">
                <v-text-field
                  v-model="vmOptions"
                  style="width: 100%; padding-top: unset; margin-top: unset; margin-bottom: 5px;"
                  hide-details
                  required
                  :placeholder="$t('profile.vmOptionsHint')"
                />
              </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>

          <v-subheader>Minecraft</v-subheader>

          <v-list-tile>
            <v-list-tile-content style="flex: 1">
              <v-list-tile-title>{{ $t('profile.mcOptions') }}</v-list-tile-title>
              <v-list-tile-sub-title>
                <v-text-field
                  v-model="mcOptions"
                  style="width: 100%; padding-top: unset; margin-top: unset; margin-bottom: 5px;"
                  hide-details
                  required
                  :placeholder="$t('profile.mcOptionsHint')"
                />
              </v-list-tile-sub-title>
            </v-list-tile-content>
          </v-list-tile>

          <v-list-tile>
            <v-list-tile-content>
              <v-list-tile-title>{{ $t('profile.launchArguments') }}</v-list-tile-title>
              <v-list-tile-sub-title>{{ java ? java.path : $t('java.locationPlaceHolder') }}</v-list-tile-sub-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-btn
                icon
                @click="showPreview"
              >
                <v-icon>print</v-icon>
              </v-btn>
            </v-list-tile-action>
          </v-list-tile>
        </v-list>
      </v-flex>
    </v-layout>
    <v-dialog
      v-model="isPreviewShown"
      :width="500"
      style="overflow: hidden"
    >
      <v-card>
        <v-toolbar color="primary">{{ $t('profile.launchArguments') }}</v-toolbar>
        <v-textarea
          hide-details
          readonly
          box
          :value="preview"
          no-resize
          :height="480"
        />
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script lang=ts>
import {
  reactive,
  defineComponent,
  toRefs,
  computed,
} from '@vue/composition-api';
import { JavaRecord } from '@universal/entities/java';
import {
  useI18n,
  useAutoSaveLoad,
  useNativeDialog,
  useInstance,
  useJava,
  useLaunchPreview,
} from '@/hooks';
import JavaList from './AdvancedSettingPageJavaList.vue';

export default defineComponent({
  components: { JavaList },
  setup() {
    const { $t } = useI18n();
    const { showOpenDialog } = useNativeDialog();
    const {
      editInstance: edit,
      maxMemory,
      minMemory,
      vmOptions,
      mcOptions,
      java,
    } = useInstance();
    const { preview, refresh } = useLaunchPreview();
    const { all: javas, add, remove, refreshLocalJava, refreshing: refreshingLocalJava } = useJava();

    const data = reactive({
      vmOptions: '',
      mcOptions: '',
      maxMemory: undefined as number | undefined,
      minMemory: undefined as number | undefined,
      memoryRange: [256, 10240],
      memoryRule: [(v: any) => Number.isInteger(v)],

      javaValid: true,
      java: { path: '', version: '', majorVersion: 0 },

      isPreviewShown: false,
    });
    function save() {
      return edit({
        minMemory: data.minMemory ? Number.parseInt(data.minMemory as any, 10) : -1,
        maxMemory: data.maxMemory ? Number.parseInt(data.maxMemory as any, 10) : -1,
        vmOptions: data.vmOptions.split(' ').filter(v => v.length !== 0),
        mcOptions: data.mcOptions.split(' ').filter(v => v.length !== 0),
        java: data.java.path,
      });
    }
    function load() {
      data.maxMemory = maxMemory.value <= 0 ? undefined : maxMemory.value;
      data.minMemory = minMemory.value <= 0 ? undefined : minMemory.value;
      data.vmOptions = vmOptions.value.join(' ');
      data.mcOptions = mcOptions.value.join(' ');
      data.java = javas.value.find(j => j.path === java.value)! ?? data.java;
    }
    function showPreview() {
      save()
        .then(refresh)
        .then(() => {
          data.isPreviewShown = true;
        });
    }
    useAutoSaveLoad(save, load);

    return {
      ...toRefs(data),
      preview: computed(() => preview.value.join('\n')),
      refresh,
      javas,
      async browseFile() {
        const { filePaths } = await showOpenDialog({
          title: $t('java.browser'),
        });
        filePaths.forEach(add);
      },
      showPreview,
      removeJava: remove,
      refreshLocalJava,
      refreshingLocalJava,
    };
  },
});
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important;
}
.theme--dark.v-list .v-list__group--active:after,
.theme--dark.v-list .v-list__group--active:before {
  background: unset;
}
</style>
<style>
.v-textarea.v-text-field--enclosed .v-text-field__slot textarea {
  word-break: break-all;
}
</style>
