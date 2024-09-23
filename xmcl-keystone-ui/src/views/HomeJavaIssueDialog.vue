<template>
  <v-dialog
    v-model="isShown"
    :persistent="isMissingJava"
    width="600"
  >
    <v-card class="rounded-lg">
      <v-toolbar
        tabs
        color="orange en-3"
        dark
      >
        <v-toolbar-title>{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text class="flex flex-col gap-2 p-4">
        <div>
          {{ t('HomeJavaIssueDialog.recommendedVersionHint', { version: status?.java?.version, range: status?.preference?.requirement }) }}
          {{ hint }}
        </div>

        <div
          v-if="needDownloadHint && !isMissingJava"
          class="border-l-3 pl-2 text-sm italic text-orange-400"
        >
          {{ t('HomeJavaIssueDialog.needDownloadHint') }}
        </div>
        <div
          v-else-if="status?.compatible !== JavaCompatibleState.Matched && status?.preferredJava"
          class="border-l-3 pl-2 text-sm italic text-orange-400"
        >
          {{ t('HomeJavaIssueDialog.selectMatchedHint') }}
        </div>
        <div
          v-else-if="status?.compatible === 1"
          class=" border-l-3 pl-2 text-sm italic text-orange-400"
        >
          {{ t('HomeJavaIssueDialog.selectSecondaryHint') }}
        </div>
      </v-card-text>

      <v-list
        nav
        class="w-full px-4 pb-4"
      >
        <v-list-item
          :color="status?.compatible === 1 ? 'red' : status?.compatible === 0 ? 'primary' : undefined"
          :input-value="typeof status?.compatible === 'number'"
          :ripple="status?.javaVersion"
          :disabled="!status?.javaVersion"
          @click="selectLocalJava"
        >
          <v-list-item-content>
            <v-list-item-title>{{ t('HomeJavaIssueDialog.optionSwitch.name', { version: status?.javaVersion ? status?.javaVersion.majorVersion : status?.javaVersion ? status?.javaVersion.majorVersion : '' }) }}</v-list-item-title>
            <v-list-item-subtitle>{{ !status?.preferredJava ? t('HomeJavaIssueDialog.optionSwitch.disabled', { version: status?.javaVersion ? status?.javaVersion.majorVersion : '' }) : t('HomeJavaIssueDialog.optionSwitch.message', { version: status?.preferredJava.path }) }}</v-list-item-subtitle>
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
          v-if="status?.javaVersion"
          :color="status?.compatible !== 0 ? 'success' : undefined"
          :input-value="status?.compatible !== 0"
          :disabled="!status?.javaVersion"
          ripple
          @click="downloadAndInstallJava"
        >
          <v-list-item-content>
            <v-list-item-title>{{ t('HomeJavaIssueDialog.optionAutoDownload.name') }}</v-list-item-title>
            <v-list-item-subtitle>{{ t('HomeJavaIssueDialog.optionAutoDownload.message', { version: status?.javaVersion.majorVersion }) }}</v-list-item-subtitle>
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
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import { useRefreshable, useService, useServiceBusy } from '@/composables'
import { kInstance } from '@/composables/instance'
import { JavaCompatibleState, kInstanceJava } from '@/composables/instanceJava'
import { injection } from '@/util/inject'
import { InstanceServiceKey, JavaServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { JavaIssueDialogKey } from '../composables/java'
import { useNotifier } from '../composables/notifier'

const { showOpenDialog } = windowController
const { t } = useI18n()
const { isShown } = useDialog(JavaIssueDialogKey)
const { editInstance } = useService(InstanceServiceKey)
const { installDefaultJava, refreshLocalJava, resolveJava: add } = useService(JavaServiceKey)
const { subscribeTask } = useNotifier()
const downloadingJava = useServiceBusy(JavaServiceKey, 'installDefaultJava')

const { path } = injection(kInstance)
const { status } = injection(kInstanceJava)

const isMissingJava = computed(() => status.value?.noJava)
const title = computed(() => (!isMissingJava.value
  ? t('HomeJavaIssueDialog.incompatibleJava', { javaVersion: status.value?.java?.version ?? status.value?.javaPath ?? '' })
  : t('HomeJavaIssueDialog.missingJava')))
const hint = computed(() => (!isMissingJava.value
  ? t('HomeJavaIssueDialog.incompatibleJavaHint', { javaVersion: status.value?.java?.version })
  : t('HomeJavaIssueDialog.missingJavaHint')))
const needDownloadHint = computed(() => !status.value?.javaVersion)

const { refresh, refreshing } = useRefreshable(async () => {
  await refreshLocalJava(true)
})
async function selectLocalJava() {
  if (status.value?.preferredJava) {
    subscribeTask(editInstance({ instancePath: path.value, java: status.value.preferredJava.path }), t('java.modifyInstance'))
    isShown.value = false
  }
}
function downloadAndInstallJava() {
  if (status.value?.javaVersion) {
    subscribeTask(installDefaultJava(status.value.javaVersion), t('java.modifyInstance'))
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
  subscribeTask(editInstance({ instancePath: path.value, java: javas.find((j) => !!j)!.path }), t('java.modifyInstance'))
  isShown.value = false
}

watch(isShown, (shown) => {
  if (shown) {
    refresh()
  }
})

</script>
