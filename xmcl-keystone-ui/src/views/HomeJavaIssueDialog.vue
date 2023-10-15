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
          {{ t('HomeJavaIssueDialog.recommendedVersionHint', { version: recommendation?.version, range: recommendation?.requirement }) }}
          {{ hint }}
        </div>

        <div
          v-if="needDownloadHint && !isMissingJava"
          class="border-l-3 pl-2 text-sm italic text-orange-400"
        >
          {{ t('HomeJavaIssueDialog.needDownloadHint') }}
        </div>
        <div
          v-else-if="recommendation?.recommendedVersion && recommendation?.recommendedLevel === 0"
          class="border-l-3 pl-2 text-sm italic text-orange-400"
        >
          {{ t('HomeJavaIssueDialog.selectMatchedHint') }}
        </div>
        <div
          v-else-if="recommendation?.recommendedVersion && recommendation?.recommendedLevel === 1"
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
          :color="recommendation?.recommendedLevel === 1 ? 'red' : recommendation?.recommendedLevel === 0 ? 'primary' : undefined"
          :input-value="typeof recommendation?.recommendedLevel === 'number'"
          :ripple="recommendation?.recommendedVersion"
          :disabled="!recommendation?.recommendedVersion"
          @click="selectLocalJava"
        >
          <v-list-item-content>
            <v-list-item-title>{{ t('HomeJavaIssueDialog.optionSwitch.name', { version: recommendation?.recommendedVersion ? recommendation?.recommendedVersion.majorVersion : recommendation?.recommendedDownload ? recommendation?.recommendedDownload.majorVersion : '' }) }}</v-list-item-title>
            <v-list-item-subtitle>{{ !recommendation?.recommendedVersion ? t('HomeJavaIssueDialog.optionSwitch.disabled', { version: recommendation?.recommendedDownload ? recommendation?.recommendedDownload.majorVersion : '' }) : t('HomeJavaIssueDialog.optionSwitch.message', { version: recommendation?.recommendedVersion.path }) }}</v-list-item-subtitle>
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
          v-if="recommendation?.recommendedDownload"
          :color="recommendation?.recommendedLevel !== 0 ? 'success' : undefined"
          :input-value="recommendation?.recommendedLevel !== 0"
          :disabled="!recommendation?.recommendedDownload"
          ripple
          @click="downloadAndInstallJava"
        >
          <v-list-item-content>
            <v-list-item-title>{{ t('HomeJavaIssueDialog.optionAutoDownload.name') }}</v-list-item-title>
            <v-list-item-subtitle>{{ t('HomeJavaIssueDialog.optionAutoDownload.message', { version: recommendation?.recommendedDownload.majorVersion }) }}</v-list-item-subtitle>
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
import { kInstanceJava } from '@/composables/instanceJava'
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
const java = injection(kInstanceJava)

const recommendation = java.recommendation

const isMissingJava = computed(() => recommendation.value?.reason === 'missing')
const title = computed(() => (!isMissingJava.value
  ? t('HomeJavaIssueDialog.incompatibleJava', { javaVersion: recommendation.value?.selectedJava?.version ?? recommendation.value?.selectedJavaPath ?? '' })
  : t('HomeJavaIssueDialog.missingJava')))
const hint = computed(() => (!isMissingJava.value
  ? t('HomeJavaIssueDialog.incompatibleJavaHint', { javaVersion: recommendation.value?.selectedJava?.version })
  : t('HomeJavaIssueDialog.missingJavaHint')))
const needDownloadHint = computed(() => !recommendation.value?.recommendedVersion)

const { refresh, refreshing } = useRefreshable(async () => {
  await refreshLocalJava(true)
})
async function selectLocalJava() {
  if (recommendation.value?.recommendedVersion?.path) {
    subscribeTask(editInstance({ instancePath: path.value, java: recommendation.value.recommendedVersion.path }), t('java.modifyInstance'))
    isShown.value = false
  }
}
function downloadAndInstallJava() {
  if (recommendation.value?.recommendedDownload) {
    subscribeTask(installDefaultJava(recommendation.value.recommendedDownload), t('java.modifyInstance'))
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
