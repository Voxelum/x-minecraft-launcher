<template>
  <v-container grid-list-xs fill-height style="overflow: auto;">
    <v-layout row wrap justify-start align-content-start>
      <v-flex tag="h1" class="white--text" xs12>
        <span class="headline">{{ $t('profile.launchingDetail') }}</span>
      </v-flex>
      <v-flex d-flex xs12>
        <v-select v-model="java" 
                  hide-details 
                  outline 
                  required
                  prepend-inner-icon="add" 
                  :item-text="getJavaText"
                  :item-value="getJavaValue" 
                  :label="$t('java.location')"
                  :placeholder="$t('java.locationPlaceHolder')"
                  :items="javas" 
                  :menu-props="{ auto: true, overflowY: true }" 
                  @click:prepend-inner="browseFile" />
      </v-flex>
      <v-flex d-flex xs6>
        <v-text-field v-model="minMemory" 
                      hide-details 
                      outline 
                      type="number" 
                      required 
                      clearable 
                      :label="$t('java.minMemory')"
                      :placeholder="$t('java.noMemory')" />
      </v-flex>
      <v-flex d-flex xs6>
        <v-text-field v-model="maxMemory" 
                      hide-details 
                      outline 
                      type="number" 
                      required 
                      clearable 
                      :label="$t('java.maxMemory')" 
                      :placeholder="$t('java.noMemory')" />
      </v-flex>
      <v-flex d-flex xs12>
        <args-combobox v-model="vmOptions" 
                       :label="$t('profile.vmOptions')" 
                       :create-hint="$t('profile.vmOptionsCreateHint')"
                       :hint="$t('profile.vmOptionsHint')" />
      </v-flex>
      <v-flex d-flex xs12>
        <args-combobox v-model="mcOptions" 
                       :label="$t('profile.mcOptions')" 
                       :create-hint="$t('profile.mcOptionsCreateHint')"
                       :hint="$t('profile.mcOptionsHint')" />
      </v-flex>
    </v-layout>
  </v-container>
</template>

<script lang=ts>
import {
  reactive,
  createComponent,
  toRefs,
} from '@vue/composition-api';
import { Java } from '@universal/store/modules/java';
import {
  useI18n,
  useAutoSaveLoad,
  useNativeDialog,
  useInstance,
  useJava,
} from '@/hooks';

export default createComponent({
  setup() {
    const { $t } = useI18n();
    const { showOpenDialog } = useNativeDialog();
    const {
      edit,
      maxMemory,
      minMemory,
      vmOptions,
      mcOptions,
      java,
      javaPath,
      setJavaPath,
    } = useInstance();
    const { all: javas, add } = useJava();

    const data = reactive({
      vmOptions: [] as { text: string }[],
      mcOptions: [] as { text: string }[],
      maxMemory: undefined as number | undefined,
      minMemory: undefined as number | undefined,
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
        java: data.java.version.toString(),
      });
      setJavaPath(data.java.path);
    }
    function load() {
      data.maxMemory = maxMemory.value;
      data.minMemory = minMemory.value;
      data.vmOptions = vmOptions.value.map(a => ({ text: a }));
      data.mcOptions = mcOptions.value.map(a => ({ text: a }));
      if (javaPath.value) {
        const found = javas.value.find(j => j.path === javaPath.value);
        if (found) { data.java = found; }
      } else if (java.value) {
        const found = javas.value.find(j => j.version === java.value || j.majorVersion.toString() === java.value);
        if (found) { data.java = found; }
      }
    }
    useAutoSaveLoad(save, load);

    return {
      ...toRefs(data),
      javas,
      async browseFile() {
        const { filePaths } = await showOpenDialog({
          title: $t('java.browser'),
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
