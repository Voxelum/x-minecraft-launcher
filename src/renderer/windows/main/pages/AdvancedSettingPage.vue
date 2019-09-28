<template>
  <v-container grid-list-xs fill-height style="overflow: auto;">
    <v-layout row wrap justify-start align-content-start>
      <v-flex tag="h1" class="white--text" xs12>
        <span class="headline">{{ $t('profile.launchingDetail') }}</span>
      </v-flex>
      <v-flex d-flex xs12>
        <v-select v-model="java" hide-details outline :item-text="getJavaText"
                  :item-value="getJavaValue" prepend-inner-icon="add" :label="$t('java.location')" :items="javas" required
                  :menu-props="{ auto: true, overflowY: true }" @click:prepend-inner="browseFile" />
      </v-flex>
      <v-flex d-flex xs6>
        <v-text-field v-model="minMemory" hide-details outline type="number" :label="$t('java.minMemory')"
                      required clearable :placeholder="$t('java.noMemory')" />
      </v-flex>
      <v-flex d-flex xs6>
        <v-text-field v-model="maxMemory" hide-details outline type="number" :label="$t('java.maxMemory')" 
                      required clearable :placeholder="$t('java.noMemory')" />
      </v-flex>
      <v-flex d-flex xs12>
        <args-combobox v-model="vmOptions" :label="$t('profile.vmOptions')" :create-hint="$t('profile.vmOptionsCreateHint')"
                       :hint="$t('profile.vmOptionsHint')" />
      </v-flex>
      <v-flex d-flex xs12>
        <args-combobox v-model="mcOptions" :label="$t('profile.mcOptions')" :create-hint="$t('profile.mcOptionsCreateHint')"
                       :hint="$t('profile.mcOptionsHint')" />
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import { useStore, useI18n, l } from '..';
import { reactive, computed, onMounted, onDeactivated, createComponent, onActivated, onUnmounted, toRefs } from '@vue/composition-api';
import { Java } from 'universal/store/modules/java';
import { remote } from 'electron';

export default createComponent({
  setup() {
    const { dispatch, state, getters } = useStore();
    const { t } = useI18n();
    const data: {
      vmOptions: Array<{text: string}>;
      mcOptions: Array<{text: string}>;
      maxMemory?: number;
      minMemory?: number;
      memoryRange: number[];
      memoryRule: Function[];
      java: Java;
    } = reactive({
      vmOptions: [],
      mcOptions: [],
      maxMemory: undefined,
      minMemory: undefined,
      memoryRange: [256, 10240],
      memoryRule: [(v: any) => Number.isInteger(v)],

      javaValid: true,
      java: { path: '', version: '', majorVersion: 0 },
    });
    const javas = computed(() => state.java.all);
    function save() {
      dispatch('editProfile', {
        minMemory: data.minMemory,
        maxMemory: data.maxMemory,
        vmOptions: data.vmOptions.map(o => o.text),
        mcOptions: data.mcOptions.map(o => o.text),
        java: data.java,
      });
    }
    function load() {
      const profile = getters.selectedProfile;
      data.maxMemory = profile.maxMemory;
      data.minMemory = profile.minMemory;
      data.vmOptions = profile.vmOptions.map(a => ({ text: a }));
      data.mcOptions = profile.mcOptions.map(a => ({ text: a }));

      if (profile.java) {
        const found = javas.value.find(j => j.path === profile.java.path);
        if (found) {
          data.java = found; 
        }
      }
    }
    onMounted(() => load());
    onActivated(() => load());
    onDeactivated(() => save());
    onUnmounted(() => save());
    return {
      ...toRefs(data),
      javas,
      browseFile() {
        remote.dialog.showOpenDialog({
          // title: t('java.browse').toString(),
          title: l`java.browser`,
        }, (filePaths, bookmarks) => {
          if (!filePaths) return;
          filePaths.forEach((p) => {
            dispatch('resolveJava', p);
          });
        });
      },
      getJavaValue(java: Java) {
        return java;
      },
      getJavaText(java: Java) {
        return `JRE${java.majorVersion}, ${java.path}`;
      },
    };
  },
});
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important;
}
</style>
