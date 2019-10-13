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
import {
  useI18n,
  useAutoSaveLoad,
  useNativeDialog,
  useProfile,
  useJava,
} from '@/hooks';
import {
  reactive,
  computed,
  createComponent,
  toRefs,
} from '@vue/composition-api';
import { Java } from 'universal/store/modules/java';

export default createComponent({
  setup() {
    const { t } = useI18n();
    const { showOpenDialog } = useNativeDialog();
    const {
      edit,
      maxMemory,
      minMemory,
      vmOptions,
      mcOptions,
      java,
    } = useProfile();
    const { all: javas, add } = useJava();
    useAutoSaveLoad(save, load);

    const data: {
      vmOptions: Array<{ text: string }>;
      mcOptions: Array<{ text: string }>;
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
    function save() {
      edit({
        minMemory: data.minMemory,
        maxMemory: data.maxMemory,
        vmOptions: data.vmOptions.map(o => o.text),
        mcOptions: data.mcOptions.map(o => o.text),
        java: data.java,
      });
    }
    function load() {
      data.maxMemory = maxMemory.value;
      data.minMemory = minMemory.value;
      data.vmOptions = vmOptions.value.map(a => ({ text: a }));
      data.mcOptions = mcOptions.value.map(a => ({ text: a }));

      if (java.value) {
        const found = javas.value.find(j => j.path === java.value.path);
        if (found) {
          data.java = found;
        }
      }
    }
    return {
      ...toRefs(data),
      javas,
      async browseFile() {
        const { filePaths, bookmarks } = await showOpenDialog({
          title: t('java.browser'),
        });
        filePaths.forEach(add);
      },
      getJavaValue: (java: Java) => java,
      getJavaText: (java: Java) => `JRE${java.majorVersion}, ${java.path}`,
    };
  },
});
</script>

<style scoped=true>
.flex {
  padding: 6px 8px !important;
}
</style>
