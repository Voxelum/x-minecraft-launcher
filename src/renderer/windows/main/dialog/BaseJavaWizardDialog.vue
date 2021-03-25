<template>
  <v-dialog
    v-model="isShown"
    :persistent="missing"
    width="600"
  >
    <v-card
      dark
      color="grey darken-4"
    >
      <v-toolbar
        dark
        tabs
        color="grey darken-3"
      >
        <v-toolbar-title>{{ reason }}</v-toolbar-title>
      </v-toolbar>
      <v-window v-model="step">
        <v-window-item :value="0">
          <v-card-text>{{ hint }}</v-card-text>

          <v-list
            style="width: 100%"
            class="grey darken-4"
            dark
          >
            <template v-for="(option, i) in options">
              <v-list-tile
                :key="i"
                ripple
                :disabled="option.disabled"
                @click="fixProblem(i)"
              >
                <v-list-tile-content>
                  <v-list-tile-title>{{ (i + 1) + '. ' + option.title }}</v-list-tile-title>
                  <v-list-tile-sub-title>{{ option.disabled ? option['disabled-message'] : option.message }}</v-list-tile-sub-title>
                </v-list-tile-content>
                <v-list-tile-action>
                  <v-icon>{{ option.autofix ? 'build' : 'arrow_right' }}</v-icon>
                </v-list-tile-action>
              </v-list-tile>
            </template>
          </v-list>
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, computed, toRefs, defineComponent } from '@vue/composition-api'
import { useI18n, useStore, useJava, useNativeDialog, useServiceOnly, useInstance } from '/@/hooks'
import { useJavaWizardDialog, useNotifier } from '../hooks'

export default defineComponent({
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
  setup() {
    const { showOpenDialog } = useNativeDialog()
    const { state } = useStore()
    const { $t } = useI18n()
    const { show, isShown, javaIssue } = useJavaWizardDialog()
    const { add, refreshLocalJava } = useJava()
    const { editInstance } = useInstance()
    const { fixNoJava } = useServiceOnly('DiagnoseService', 'fixNoJava')
    const { subscribeTask } = useNotifier()

    const java8 = computed(() => state.java.all.find(j => j.majorVersion === 8 && j.valid))
    const data = reactive({
      step: 0,

      items: [],

      status: 'none',

      options: [{
        autofix: true,
        title: $t('diagnosis.missingJava.switch'),
        message: $t('diagnosis.missingJava.switch.message'),
        'disabled-message': $t('diagnosis.missingJava.switch.disabled'),
        disabled: java8.value === undefined,
        recommended: true,
      }, {
        autofix: true,
        title: $t('diagnosis.missingJava.autoDownload'),
        message: $t('diagnosis.missingJava.autoDownload.message'),
        disabled: false,
      }, {
        title: $t('diagnosis.missingJava.selectJava'),
        message: $t('diagnosis.missingJava.selectJava.message'),
        disabled: false,
      }],
    })

    const missing = computed(() => javaIssue.value === 'missing')
    const reason = computed(() => (!missing.value ? $t('java.incompatibleJava') : $t('java.missing')))
    const hint = computed(() => (!missing.value ? $t('java.incompatibleJavaHint') : $t('java.missingHint')))

    function refresh() {
      data.status = 'resolving'
      refreshLocalJava().finally(() => {
        if (missing.value) {
          data.status = 'error'
          show()
        }
      })
    }
    function selectJava(java: { path: string }) {
      editInstance({ java: java.path })
    }
    return {
      ...toRefs(data),
      isShown,
      reason,
      hint,
      missing,
      refresh,
      selectJava,
      async fixProblem(index: number) {
        if (index === 0) {
          subscribeTask(editInstance({ java: java8.value!.path }), $t('java.modifyInstance'))
          isShown.value = false
        } else if (index === 1) {
          fixNoJava()
          isShown.value = false
        } else if (index === 2) {
          const { filePaths, canceled } = await showOpenDialog({
            title: $t('java.browse'),
          })

          if (filePaths.length === 0 || canceled) {
            return
          }

          const javas = await Promise.all(filePaths.map(add))
          subscribeTask(editInstance({ java: javas.find((j) => !!j)!.path }), $t('java.modifyInstance'))
          isShown.value = false
        }
      },
    }
  },
})
</script>

<style scoped=true>
</style>
