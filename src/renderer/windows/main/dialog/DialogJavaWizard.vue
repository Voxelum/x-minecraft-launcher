<template>
  <v-dialog v-model="isShown" :persistent="missing" width="600">
    <v-card dark color="grey darken-4">
      <v-toolbar dark tabs color="grey darken-3">
        <v-toolbar-title>
          {{ reason }}
        </v-toolbar-title>
      </v-toolbar>
      <v-window v-model="step">
        <v-window-item :value="0">
          <v-card-text>
            {{ hint }}
          </v-card-text>

          <v-list style="width: 100%" class="grey darken-4" dark>
            <template v-for="(option, i) in options">
              <v-list-tile :key="i" ripple :disabled="option.disabled" @click="fixProblem(i)">
                <v-list-tile-content>
                  <v-list-tile-title>
                    {{ (i + 1) + '. ' + option.title }}
                  </v-list-tile-title>
                  <v-list-tile-sub-title>
                    {{ option.disabled ? option['disabled-message'] : option.message }}
                  </v-list-tile-sub-title>
                </v-list-tile-content>
                <v-list-tile-action>
                  <v-icon> {{ option.autofix ? 'build' : 'arrow_right' }} </v-icon>
                </v-list-tile-action>
              </v-list-tile>
            </template>
          </v-list>
        </v-window-item>

        <v-window-item :value="1">
          <v-card-text v-if="downloadError">
            {{ $t('java.errorDownload') }}
            <div>
              {{ downloadError }}
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="back">
              {{ $t('back') }}
              <v-icon right>
                arrow_left
              </v-icon>
            </v-btn>
          </v-card-actions>
        </v-window-item>

        <v-window-item :value="2">
          <v-card-text>
            {{ status === 'none' ? $t('java.refreshAfter') : $t('java.noJavaInPath') }}
          </v-card-text>
          <v-card-actions>
            <v-btn @click="back">
              {{ $t('back') }}
              <v-icon right>
                arrow_left
              </v-icon>
            </v-btn>
            <v-spacer />
            <v-btn :loading="status==='resolving'" @click="refresh">
              {{ $t('refresh') }}
              <v-icon right>
                refresh
              </v-icon>
            </v-btn>
          </v-card-actions>
        </v-window-item>

        <v-window-item :value="3">
          <v-container v-if="status === 'resolving'" fill-height>
            <v-layout fill-height align-center justify-center>
              <v-progress-circular :size="128" indeterminate />
            </v-layout>
          </v-container>
          <v-card-text v-else-if="status === 'error'">
            {{ $t('java.noLegalJava') }}
          </v-card-text>
          <v-card-actions v-if="status === 'error'">
            <v-btn @click="back">
              {{ $t('back') }}
              <v-icon right>
                arrow_left
              </v-icon>
            </v-btn>
          </v-card-actions>
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, computed, toRefs, onMounted, onUnmounted, watch, createComponent } from '@vue/composition-api';
import { useDialogSelf, useI18n, useStore, useJava, useNativeDialog, useServiceOnly, useInstance } from '@/hooks';

export default createComponent({
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    const dialog = useNativeDialog();
    const { getters, state } = useStore();
    const { $t } = useI18n();
    const { showDialog, isShown } = useDialogSelf('java-wizard');
    const { add, refreshLocalJava, installDefault, openJavaSite } = useJava();
    const { editInstance, setJavaPath } = useInstance();
    const { fixJavaIncompatible } = useServiceOnly('DiagnoseService', 'fixJavaIncompatible');
    const java8 = computed(() => state.java.all.find(j => j.majorVersion === 8 && j.valid));
    const data = reactive({
      step: 0,

      items: [],

      status: 'none',
      downloadError: undefined,

      options: [{
        autofix: true,
        title: $t('diagnosis.missingJava.switch'),
        message: $t('diagnosis.missingJava.switch.message'),
        'disabled-message': $t('diagnosis.missingJava.switch.disabled'),
        disabled: java8.value === undefined,
      }, {
        autofix: true,
        title: $t('diagnosis.missingJava.autoDownload'),
        message: $t('diagnosis.missingJava.autoDownload.message'),
        disabled: false,
      }, {
        title: $t('diagnosis.missingJava.manualDownload'),
        message: $t('diagnosis.missingJava.manualDownload.message'),
        disabled: false,
      }, {
        title: $t('diagnosis.missingJava.selectJava'),
        message: $t('diagnosis.missingJava.selectJava.message'),
        disabled: false,
      }],
    });
    const missing = computed(() => getters.missingJava);
    const reason = computed(() => (!missing.value ? $t('java.incompatibleJava') : $t('java.missing')));
    const hint = computed(() => (!missing.value ? $t('java.incompatibleJavaHint') : $t('java.missingHint')));

    function updateValue() {
      if (missing.value) { showDialog(); }
    }
    function refresh() {
      data.status = 'resolving';
      refreshLocalJava().finally(() => {
        if (missing.value) {
          data.status = 'error';
          showDialog();
        } else {
          // reason.value = '';
          // hint.value = '';
        }
      });
    }

    let unwatch = () => { };
    onMounted(() => {
      updateValue();
      unwatch = watch(missing, updateValue);
    });
    onUnmounted(() => {
      unwatch();
    });

    return {
      ...toRefs(data),
      isShown,
      reason,
      hint,
      missing,
      refresh,
      async fixProblem(index: number) {
        data.step = index + 1;
        if (index === 0) {
          editInstance({ java: '8' });
          setJavaPath(java8.value!.path);
        } else if (index === 1) {
          showDialog('task');
          await fixJavaIncompatible();
        } else if (index === 2) {
          await openJavaSite();
        } else if (index === 3) {
          data.status = 'resolving';
          const { filePaths } = await dialog.showOpenDialog({
            title: $t('java.browse'),
          });
          filePaths.forEach((p) => {
            add(p).then((r) => {
              if (!r) { data.status = 'error'; }
            });
          });
        }
      },
      back() {
        data.step = 0;
        data.status = 'none';
      },
    };
  },
});
</script>

<style scoped=true>
</style>
