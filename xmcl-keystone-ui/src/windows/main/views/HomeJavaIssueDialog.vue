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
      >
        <v-toolbar-title>{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-window
        class="p-4"
      >
        <v-window-item :value="0">
          <v-card-text class="flex flex-col gap-2">
            <div>
              {{ t('recommendedVersionHint', { version: data.version, range: data.requirement }) }}
              {{ hint }}
            </div>

            <div
              v-if="needDownloadHint && !isMissingJava"
              class="text-sm text-orange-400 italic border-l-3 pl-2"
            >
              {{ t('needDownloadHint') }}
            </div>
            <div
              v-else-if="data.recommendedVersion && data.recommendedLevel === 0"
              class="text-sm text-orange-400 italic border-l-3 pl-2"
            >
              {{ t('selectMatchedHint') }}
            </div>
            <div
              v-else-if="data.recommendedVersion && data.recommendedLevel === 1"
              class=" text-sm text-orange-400 italic border-l-3 pl-2"
            >
              {{ t('selectSecondaryHint') }}
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
                <v-list-item-title>{{ t('optionSwitch.name', { version: data.recommendedVersion ? data.recommendedVersion.majorVersion : data.recommendedDownload ? data.recommendedDownload.majorVersion : '' }) }}</v-list-item-title>
                <v-list-item-subtitle>{{ !data.recommendedVersion ? t('optionSwitch.disabled', { version: data.recommendedDownload ? data.recommendedDownload.majorVersion : '' }) : t('optionSwitch.message', { version: data.recommendedVersion.path }) }}</v-list-item-subtitle>
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
                <v-list-item-title>{{ t('optionAutoDownload.name') }}</v-list-item-title>
                <v-list-item-subtitle>{{ t('optionAutoDownload.message', { version: data.recommendedDownload.majorVersion }) }}</v-list-item-subtitle>
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
                <v-list-item-title>{{ t('optionSelectJava.name') }}</v-list-item-title>
                <v-list-item-subtitle>{{ t('optionSelectJava.message') }}</v-list-item-subtitle>
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
import { IssueHandlerKey, useServiceBusy, useI18n, useService, useRefreshable } from '/@/composables'
import { DiagnoseServiceKey, IncompatibleJavaIssueKey, InvalidJavaIssueKey, Java, JavaCompatibleState, JavaServiceKey, MissingJavaIssueKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { JavaVersion } from '@xmcl/core'
import { useInstance } from '../composables/instance'
import { JavaIssueDialogKey, useJava } from '../composables/java'
import { useNotifier } from '../composables/notifier'
import { injection } from '/@/util/inject'

const { showOpenDialog } = windowController
const { t } = useI18n()
const { show, isShown, hide } = useDialog(JavaIssueDialogKey)
const { add } = useJava()
const { editInstance } = useInstance()
const { installDefaultJava, refreshLocalJava } = useService(JavaServiceKey)
const { subscribeTask } = useNotifier()
const { state } = useService(DiagnoseServiceKey)
const downloadingJava = useServiceBusy(JavaServiceKey, 'installDefaultJava')
const handlers = injection(IssueHandlerKey)

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
const title = computed(() => (!isMissingJava.value ? t('incompatibleJava', { javaVersion: data.selectedJava?.version ?? data.selectedJavaPath ?? '' }) : t('missingJava')))
const hint = computed(() => (!isMissingJava.value ? t('incompatibleJavaHint') : t('missingJavaHint')))

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

<i18n locale="en" lang="yaml">
missingJava: Missing Java
missingJavaHint: 'The Launcher cannot detect any java in your computer. You can:'
incompatibleJava: Incompatible Java
incompatibleJavaHint: Current Java might be incompatible with selected Minecraft!

recommendedVersionHint: The {version} recommend to use Java with range {range}。
needDownloadHint: Cannot find proper Java version in your computed. Recommend to download a new one.
selectMatchedHint: Found proper local Java versions. You can choose these local Javas.
selectSecondaryHint: Found some local Java versions, but they might not suitable to the criteria. You can still use them to launch, but this issue will still appear.

optionManualDownload:
  message: Launcher will redirect you to the Orecale JRE download page.
  name: Manually Download
optionSelectJava:
  message: >-
    Maybe the launcher doesn't found your Java. You can tell the launcher
    where it is.
  name: Select Java in your computer
optionAutoDownload:
  message: Launcher will download and install Java from Mojang's source for you.
  name: Automatically Download
optionSwitch:
  disabled: There is no Java {version} found in database now!
  message: Use existed Java {version} in you PC
  name: Switch to {version}
</i18n>

<i18n locale="zh-CN" lang="yaml">
missingJava: 没有找到 Java
missingJavaHint: 启动器在你的电脑上没有找到任何Java。你可以尝试：
incompatibleJava: 当前的 Java 版本可能不兼容
incompatibleJavaHint: 当前已选择 Java {javaVersion}。此 Java 可能无法运已选择的 Minecraft 版本

recommendedVersionHint: 版本 {version} 推荐使用 Java 版本范围 {range}。
needDownloadHint: 在你的电脑上没找到合适的 Java 版本，推荐下载新的 Java。
selectMatchedHint: 本地找到了符合的 Java 版本，你可以选择本地 Java。
selectSecondaryHint: 本地找到了几个 Java 版本，但都不是完全符合要求的 Java。你仍旧可以选择这些 Java 启动，但此提示还会再次出现。

optionManualDownload:
  message: 启动器将把你转到Oracle官方JRE下载网站
  name: 手动下载
optionSelectJava:
  message: 也许只是启动器没找到你电脑里的Java,你可以手工选择一下
  name: 手工选择Java的位置
optionAutoDownload:
  message: 启动器将从 Mojang 源下载并安装 Java {version}
  name: 自动下载
optionSwitch:
  disabled: 在电脑中没有检测到 Java {version}，无法切换
  message: 启动器将使用您现在安装的 {version}
  name: 切换到已有的 Java {version}
</i18n>

<i18n locale="ru" lang="yaml">
missingJava: Java отсутствует
missingJavaHint: 'Лаунчер не может найти на вашем компьютере Java. Вы можете:'
incompatibleJava: Несовместимая Java
incompatibleJavaHint: Вы можете использовать найденую Java или скачать новую!

optionManualDownload:
  name: Скачать вручную
  message: Лаунчер перенаправит вас на страницу скачивания Orecale JRE.
optionSelectJava:
  name: Выберите Java на вашем компьютере
  message: >-
    Видимо лаунчер не нашёл установленную Java. Вы можете указать лаунчеру
    его расположение.
optionAutoDownload:
  name: Скачать автоматически
  message: Лаунчер скачает и установит Java из исходного кода Mojang.
optionSwitch:
  name: Переключить на Java {version}
  disabled: Сейчас в базе данных нет {version}!
  message: Используйте существующую Java {version} на своём ПК
</i18n>
