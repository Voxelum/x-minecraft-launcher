<template>
  <v-dialog
    v-model="isShown"
    :persistent="isMissingJava"
    width="600"
  >
    <v-card>
      <v-toolbar
        tabs
        color="orange en-3"
        dark
      >
        <v-toolbar-title>{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-window
        class="p-4"
      >
        <v-window-item :value="0">
          <v-card-text class="flex flex-col gap-2">
            <div>
              {{ t('HomeJavaIssueDialog.recommendedVersionHint', { version: data.version, range: data.requirement }) }}
              {{ hint }}
            </div>

            <div
              v-if="needDownloadHint && !isMissingJava"
              class="text-sm text-orange-400 italic border-l-3 pl-2"
            >
              {{ t('HomeJavaIssueDialog.needDownloadHint') }}
            </div>
            <div
              v-else-if="data.recommendedVersion && data.recommendedLevel === 0"
              class="text-sm text-orange-400 italic border-l-3 pl-2"
            >
              {{ t('HomeJavaIssueDialog.selectMatchedHint') }}
            </div>
            <div
              v-else-if="data.recommendedVersion && data.recommendedLevel === 1"
              class=" text-sm text-orange-400 italic border-l-3 pl-2"
            >
              {{ t('HomeJavaIssueDialog.selectSecondaryHint') }}
            </div>
          </v-card-text>

          <v-list
            style="width: 100%"
          >
            <v-list-item
              :color="data.recommendedLevel === 1 ? 'red' : data.recommendedLevel === 0 ? 'primary' : undefined"
              :input-value="typeof data.recommendedLevel === 'number'"
              :ripple="data.recommendedVersion"
              :disabled="!data.recommendedVersion"
              @click="selectLocalJava"
            >
              <v-list-item-content>
                <v-list-item-title>{{ t('HomeJavaIssueDialog.optionSwitch.name', { version: data.recommendedVersion ? data.recommendedVersion.majorVersion : data.recommendedDownload ? data.recommendedDownload.majorVersion : '' }) }}</v-list-item-title>
                <v-list-item-subtitle>{{ !data.recommendedVersion ? t('HomeJavaIssueDialog.optionSwitch.disabled', { version: data.recommendedDownload ? data.recommendedDownload.majorVersion : '' }) : t('HomeJavaIssueDialog.optionSwitch.message', { version: data.recommendedVersion.path }) }}</v-list-item-subtitle>
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
              v-if="data.recommendedDownload"
              :color="data.recommendedLevel !== 0 ? 'success' : undefined"
              :input-value="data.recommendedLevel !== 0"
              :disabled="!data.recommendedDownload"
              ripple
              @click="downloadAndInstallJava"
            >
              <v-list-item-content>
                <v-list-item-title>{{ t('HomeJavaIssueDialog.optionAutoDownload.name') }}</v-list-item-title>
                <v-list-item-subtitle>{{ t('HomeJavaIssueDialog.optionAutoDownload.message', { version: data.recommendedDownload.majorVersion }) }}</v-list-item-subtitle>
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
              color="red"
              :ripple="!downloadingJava"
              :disabled="downloadingJava"
              @click="findLocalJava"
            >
              <v-list-item-content>
                <v-list-item-title>{{ t('HomeJavaIssueDialog.optionSelectJava.name') }}</v-list-item-title>
                <v-list-item-subtitle>{{ t('HomeJavaIssueDialog.optionSelectJava.message') }}</v-list-item-subtitle>
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

<script lang=ts setup>
import { kIssueHandlers, useServiceBusy, useService, useRefreshable } from '@/composables'
import { DiagnoseServiceKey, IncompatibleJavaIssueKey, InstanceServiceKey, InvalidJavaIssueKey, Java, JavaCompatibleState, JavaServiceKey, MissingJavaIssueKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { JavaVersion } from '@xmcl/core'
import { JavaIssueDialogKey, useJava } from '../composables/java'
import { useNotifier } from '../composables/notifier'
import { injection } from '@/util/inject'

const { showOpenDialog } = windowController
const { t } = useI18n()
const { show, isShown, hide } = useDialog(JavaIssueDialogKey)
const { add } = useJava()
const { editInstance } = useService(InstanceServiceKey)
const { installDefaultJava, refreshLocalJava } = useService(JavaServiceKey)
const { subscribeTask } = useNotifier()
const { state } = useService(DiagnoseServiceKey)
const downloadingJava = useServiceBusy(JavaServiceKey, 'installDefaultJava')
const handlers = injection(kIssueHandlers)

const data = reactive({
  type: '' as 'incompatible' | 'missing' | 'invalid',
  requirement: '',
  version: '',
  minecraft: '',
  forge: '',
  recommendedDownload: undefined as undefined | JavaVersion,
  recommendedVersion: undefined as undefined | Java,
  recommendedLevel: undefined as undefined | JavaCompatibleState,

  selectedJava: undefined as undefined | Java,
  selectedJavaPath: undefined as undefined | string,
})

// TODO: fix reactivity
const hasIssue = computed(() => {
  const hasJavaIssue = state.report[InvalidJavaIssueKey as string]?.parameters.length > 0 ||
  state.report[IncompatibleJavaIssueKey as string]?.parameters.length > 0 ||
  state.report[MissingJavaIssueKey as string]?.parameters.length > 0
  return hasJavaIssue
})

const isMissingJava = computed(() => data.type === 'missing')
const title = computed(() => (!isMissingJava.value ? t('HomeJavaIssueDialog.incompatibleJava', { javaVersion: data.selectedJava?.version ?? data.selectedJavaPath ?? '' }) : t('HomeJavaIssueDialog.missingJava')))
const hint = computed(() => (!isMissingJava.value ? t('HomeJavaIssueDialog.incompatibleJavaHint', { javaVersion: data.selectedJava?.version }) : t('HomeJavaIssueDialog.missingJavaHint')))

watch(hasIssue, (newValue) => {
  if (!newValue) {
    hide()
  }
})

handlers.register(InvalidJavaIssueKey, (issue) => {
  data.type = 'invalid'
  data.requirement = issue.requirement
  data.version = issue.version
  data.minecraft = issue.minecraft
  data.forge = issue.forge
  data.recommendedDownload = issue.recommendedDownload
  data.recommendedLevel = issue.recommendedLevel
  data.recommendedVersion = issue.recommendedVersion
  data.selectedJavaPath = issue.selectedJavaPath

  show()
})

handlers.register(IncompatibleJavaIssueKey, (issue) => {
  data.type = 'incompatible'
  data.requirement = issue.requirement
  data.version = issue.version
  data.minecraft = issue.minecraft
  data.forge = issue.forge
  data.recommendedDownload = issue.recommendedDownload
  data.recommendedLevel = issue.recommendedLevel
  data.recommendedVersion = issue.recommendedVersion
  data.selectedJava = issue.selectedJava

  show()
})

handlers.register(MissingJavaIssueKey, (issue) => {
  data.type = 'missing'
  data.requirement = issue.requirement
  data.version = issue.version
  data.minecraft = issue.minecraft
  data.forge = issue.forge
  data.recommendedDownload = issue.recommendedDownload
  show()
})

const { refresh, refreshing } = useRefreshable(async () => {
  await refreshLocalJava(true)
})
async function selectLocalJava() {
  subscribeTask(editInstance({ java: data.recommendedVersion!.path }), t('java.modifyInstance'))
  isShown.value = false
}
function downloadAndInstallJava() {
  if (data.recommendedDownload) {
    subscribeTask(installDefaultJava(data.recommendedDownload), t('java.modifyInstance'))
    isShown.value = false
  }
}
async function findLocalJava() {
  const { filePaths, canceled } = await showOpenDialog({
    title: t('java.browse'),
  })

  if (filePaths.length === 0 || canceled) {
    return
  }

  const javas = await Promise.all(filePaths.map(add))
  subscribeTask(editInstance({ java: javas.find((j) => !!j)!.path }), t('java.modifyInstance'))
  isShown.value = false
}

watch(isShown, (shown) => {
  if (shown) {
    refresh()
  }
})

const needDownloadHint = computed(() => !data.recommendedVersion)

</script>
