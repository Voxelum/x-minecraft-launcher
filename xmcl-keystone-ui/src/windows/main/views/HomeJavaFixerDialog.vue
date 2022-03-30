<template>
  <v-dialog
    v-model="isShown"
    :persistent="missing"
    width="600"
  >
    <v-card>
      <v-toolbar
        tabs
        color="orange en-3"
      >
        <v-toolbar-title>{{ reason }}</v-toolbar-title>
      </v-toolbar>
      <v-window
        class="p-4"
      >
        <v-window-item :value="0">
          <v-card-text>{{ hint }}</v-card-text>

          <v-list
            style="width: 100%"
          >
            <v-list-item
              :ripple="!disableUseExistedJava"
              :disabled="disableUseExistedJava"
              @click="selectLocalJava"
            >
              <v-list-item-content>
                <v-list-item-title>1. {{ $t('diagnosis.missingJava.switch', { version: javaIssue.version.majorVersion }) }}</v-list-item-title>
                <v-list-item-subtitle>{{ disableUseExistedJava ? $t('diagnosis.missingJava.switch.disabled', { version: javaIssue.version.majorVersion }) : $t('diagnosis.missingJava.switch.message', { version: javaIssue.version.majorVersion }) }}</v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-icon v-if="!refreshing">
                  build
                </v-icon>
                <v-progress-circular
                  v-else
                  indeterminate
                  :size="24"
                />
              </v-list-item-action>
            </v-list-item>

            <v-list-item
              ripple
              @click="downloadAndInstallJava"
            >
              <v-list-item-content>
                <v-list-item-title>2. {{ $t('diagnosis.missingJava.autoDownload') }}</v-list-item-title>
                <v-list-item-subtitle>{{ $t('diagnosis.missingJava.autoDownload.message', { version: javaIssue.version.majorVersion }) }}</v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-icon v-if="!downloadingJava">
                  build
                </v-icon>
                <v-progress-circular
                  v-else
                  indeterminate
                  :size="24"
                />
              </v-list-item-action>
            </v-list-item>

            <v-list-item
              :ripple="!downloadingJava"
              :disabled="downloadingJava"
              @click="findLocalJava"
            >
              <v-list-item-content>
                <v-list-item-title>3. {{ $t('diagnosis.missingJava.selectJava') }}</v-list-item-title>
                <v-list-item-subtitle>{{ $t('diagnosis.missingJava.selectJava.message') }}</v-list-item-subtitle>
              </v-list-item-content>
              <v-list-item-action>
                <v-icon>arrow_right</v-icon>
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-window-item>
      </v-window>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { IssueHandler, useBusy, useI18n, useService, useRefreshable } from '/@/composables'
import { JavaServiceKey } from '@xmcl/runtime-api'
import { DialogKey, useDialog } from '../composables/dialog'
import { JavaVersion } from '@xmcl/core'
import { useInstance } from '../composables/instance'
import { useJava } from '../composables/java'
import { useNotifier } from '../composables/notifier'

export const JavaFixDialogKey: DialogKey<{ type: 'incompatible' | 'missing'; version: JavaVersion }> = 'java-fix'

export default defineComponent({
  setup() {
    const { showOpenDialog } = windowController
    const { $t } = useI18n()
    const { show, isShown } = useDialog(JavaFixDialogKey)
    const { add } = useJava()
    const { editInstance } = useInstance()
    const { state, installDefaultJava, refreshLocalJava } = useService(JavaServiceKey)
    const { subscribeTask } = useNotifier()
    const downloadingJava = useBusy('installDefaultJava()')
    const handlers = inject(IssueHandler, {})
    const javaIssue = ref({
      type: '' as 'incompatible' | 'missing' | '',
      version: { majorVersion: 8, component: 'jre-legacy' } as JavaVersion,
    })

    const matchedJava = computed(() => state.all.find(j => j.majorVersion === javaIssue.value?.version.majorVersion))
    const disableUseExistedJava = computed(() => !matchedJava.value || downloadingJava.value || !matchedJava.value.valid)
    const missing = computed(() => javaIssue.value?.type === 'missing')
    const reason = computed(() => (!missing.value ? $t('java.incompatibleJava') : $t('java.missing')))
    const hint = computed(() => (!missing.value ? $t('java.incompatibleJavaHint', { version: javaIssue.value?.version.majorVersion }) : $t('java.missingHint')))

    handlers.incompatibleJava = (issue) => {
      javaIssue.value.type = 'incompatible'
      if (!(issue.parameters instanceof Array)) {
        javaIssue.value.version = issue.parameters.targetVersion
      }
      show()
    }

    handlers.missingJava = (issue) => {
      javaIssue.value.type = 'missing'
      if (!(issue.parameters instanceof Array)) {
        javaIssue.value.version = issue.parameters.targetVersion
      }
      show()
    }

    const { refresh, refreshing } = useRefreshable(async () => {
      await refreshLocalJava(true)
    })
    async function selectLocalJava() {
      subscribeTask(editInstance({ java: matchedJava.value!.path }), $t('java.modifyInstance'))
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
