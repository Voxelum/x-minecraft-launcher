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
      <v-window
        v-model="step"
        class="p-4"
      >
        <v-window-item :value="0">
          <v-card-text>{{ hint }}</v-card-text>

          <v-list
            style="width: 100%"
            class="grey darken-4"
            dark
          >
            <v-list-tile
              :ripple="!disableUseExistedJava"
              :disabled="disableUseExistedJava"
              @click="selectLocalJava"
            >
              <v-list-tile-content>
                <v-list-tile-title>1. {{ $t('diagnosis.missingJava.switch', { version: javaIssue.version.majorVersion }) }}</v-list-tile-title>
                <v-list-tile-sub-title>{{ disableUseExistedJava ? $t('diagnosis.missingJava.switch.disabled', { version: javaIssue.version.majorVersion }) : $t('diagnosis.missingJava.switch.message', { version: javaIssue.version.majorVersion }) }}</v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-icon v-if="!refreshing">
                  build
                </v-icon>
                <v-progress-circular
                  v-else
                  indeterminate
                  :size="24"
                />
              </v-list-tile-action>
            </v-list-tile>

            <v-list-tile
              ripple
              @click="downloadAndInstallJava"
            >
              <v-list-tile-content>
                <v-list-tile-title>2. {{ $t('diagnosis.missingJava.autoDownload') }}</v-list-tile-title>
                <v-list-tile-sub-title>{{ $t('diagnosis.missingJava.autoDownload.message', { version: javaIssue.version.majorVersion }) }}</v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-icon v-if="!downloadingJava">
                  build
                </v-icon>
                <v-progress-circular
                  v-else
                  indeterminate
                  :size="24"
                />
              </v-list-tile-action>
            </v-list-tile>

            <v-list-tile
              :ripple="!downloadingJava"
              :disabled="downloadingJava"
              @click="findLocalJava"
            >
              <v-list-tile-content>
                <v-list-tile-title>3. {{ $t('diagnosis.missingJava.selectJava') }}</v-list-tile-title>
                <v-list-tile-sub-title>{{ $t('diagnosis.missingJava.selectJava.message') }}</v-list-tile-sub-title>
              </v-list-tile-content>
              <v-list-tile-action>
                <v-icon>arrow_right</v-icon>
              </v-list-tile-action>
            </v-list-tile>
          </v-list>
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { computed, defineComponent, inject, reactive, toRefs, watch } from '@vue/composition-api'
import { IssueHandler, useBusy, useI18n, useInstance, useJava, useService, useWindowController } from '/@/hooks'
import { useRefreshable } from '/@/hooks/useRefreshable'
import { useJavaWizardDialog, useNotifier } from '/@/windows/main/composables'
import { JavaServiceKey } from '@xmcl/runtime-api'

export default defineComponent({
  setup() {
    const { showOpenDialog } = useWindowController()
    const { $t } = useI18n()
    const { show, isShown, javaIssue } = useJavaWizardDialog()
    const { add } = useJava()
    const { editInstance } = useInstance()
    const { state, installDefaultJava, refreshLocalJava } = useService(JavaServiceKey)
    const { subscribeTask } = useNotifier()
    const downloadingJava = useBusy('installDefaultJava()')
    const handlers = inject(IssueHandler, {})

    const validJava = computed(() => state.all.find(j => j.majorVersion === javaIssue.value.version.majorVersion))
    const disableUseExistedJava = computed(() => !validJava.value || downloadingJava.value)
    const data = reactive({
      step: 0,
    })

    const { refresh, refreshing } = useRefreshable(async () => {
      await refreshLocalJava(true)
    })
    const missing = computed(() => javaIssue.value.type === 'missing')
    const reason = computed(() => (!missing.value ? $t('java.incompatibleJava') : $t('java.missing')))
    const hint = computed(() => (!missing.value ? $t('java.incompatibleJavaHint', { version: javaIssue.value.version.majorVersion }) : $t('java.missingHint')))

    handlers.incompatibleJava = (issue) => {
      javaIssue.value.type = 'incompatible'
      if (!(issue.parameters instanceof Array)) {
        javaIssue.value.version = issue.parameters.targetVersion
      }
      show()
    }

    handlers.missingJava = (issue) => {
      javaIssue.value.type = 'missing'
      show()
    }

    async function selectLocalJava() {
      subscribeTask(editInstance({ java: validJava.value!.path }), $t('java.modifyInstance'))
      isShown.value = false
    }
    function downloadAndInstallJava() {
      subscribeTask(installDefaultJava(javaIssue.value.version), $t('java.modifyInstance'))
      isShown.value = false
    }
    async function findLocalJava() {
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

    watch(isShown, (shown) => {
      if (shown) {
        refresh()
      }
    })

    return {
      ...toRefs(data),
      disableUseExistedJava,
      downloadingJava,
      isShown,
      reason,
      hint,
      missing,
      javaIssue,
      selectLocalJava,
      downloadAndInstallJava,
      findLocalJava,
      refresh,
      refreshing,
    }
  },
})
</script>

<style scoped=true>
</style>
