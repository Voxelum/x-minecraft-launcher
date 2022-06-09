<template>
  <v-dialog
    v-model="isShown"
    :width="500"
    :persistent="true"
  >
    <v-alert
      class="mb-0 blocked-dialog"
      border="left"
      type="error"
      prominent
    >
      <v-card
        color="transparent"
        elevation="0"
        text
      >
        <v-card-title
          primary-title
          class="text-2xl font-bold"
        >
          {{ title }}
        </v-card-title>
        <v-card-text class="text-lg">
          <span v-html="description" />

          <v-textarea
            v-if="extraText"
            :value="extraText"
            readonly
          />

          <div v-if="unexpected">
            {{ t('unexpectedText') }}
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn
            text
            @click="hide"
          >
            {{ t('ok') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-alert>
  </v-dialog>
</template>

<script lang=ts setup>
import { getExpectVersion, LaunchException, LaunchExceptions, LaunchServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useI18n, useService } from '/@/composables'
import { useExceptionHandler } from '/@/composables/exception'

const { on } = useService(LaunchServiceKey)
const { isShown, hide } = useDialog('launch-blocked')
const title = ref('')
const description = ref('')
const unexpected = ref(false)
const extraText = ref('')
const { t } = useI18n()

function onException(e: LaunchExceptions) {
  console.log(e)
  if (e.type === 'launchGeneralException') {
    title.value = t('launchGeneralException.title')
    description.value = t('launchGeneralException.description')
    unexpected.value = true
    if (e.error) {
      if (typeof (e.error as any).stack === 'string') {
        extraText.value += (e.error as any).stack
      } else if (typeof (e.error as any).message === 'string') {
        extraText.value = (e.error as any).message
      } else if (typeof (e.error as any).toString === 'function') {
        extraText.value = (e.error as any).toString()
      } else {
        extraText.value = e as any
      }
    }
  } else if (e.type === 'launchInvalidJavaPath') {
    title.value = t('launchInvalidJavaPath.title')
    description.value = t('launchInvalidJavaPath.description', { javaPath: e.javaPath })
    unexpected.value = true
    extraText.value = ''
  } else if (e.type === 'launchJavaNoPermission') {
    title.value = t('launchJavaNoPermission.title')
    description.value = t('launchJavaNoPermission.description', { javaPath: e.javaPath })
    unexpected.value = false
    extraText.value = ''
  } else if (e.type === 'launchNoProperJava') {
    title.value = t('launchNoProperJava.title')
    description.value = t('launchNoProperJava.description', { javaPath: e.javaPath })
    unexpected.value = true
    extraText.value = ''
  } else if (e.type === 'launchNoVersionInstalled') {
    title.value = t('launchNoVersionInstalled.title')
    description.value = t('launchNoVersionInstalled.description', { version: e.override || e.version || getExpectVersion(e) })
    unexpected.value = true
    extraText.value = ''
  }
  isShown.value = true
}

on('error', (e) => {
  onException(e.exception)
})

useExceptionHandler(LaunchException, (e) => {
  onException(e)
})
</script>

<style>
.blocked-dialog .highlight {
  @apply rounded p-1 text-white font-bold;
}
</style>

<i18n locale="en" lang="yaml">
launchGeneralException:
  title: Launch Failed
  description: Some errors cause the launch failed.
launchInvalidJavaPath:
  title: Invalid Java Path
  description: The selected java is missing or invalid. Please select a new one. <span class="highlight"> {javaPath} </span>
launchJavaNoPermission:
  title: No permission to launch
  description: The launcher don't have permission to execute the java <span class="highlight"> {javaPath} </span>. Either change the permission of the java file or raise the permission of launcher.
launchNoProperJava:
  title: No proper java found
  description: No proper java can be selected to launch the game. ({javaPath} is invalid?)
launchNoVersionInstalled:
  title: No version selected
  description: Cannot resolve version <span class="highlight">{version}</span> to launch.
unexpectedText: This is unexpected. You can restart the launcher to mitigate the issue. Please contact author if this issue happens again.
</i18n>

<i18n locale="zh-CN" lang="yaml">
launchGeneralException:
  title: 无法启动
  description: 一些未知错误导致启动失败。
launchInvalidJavaPath:
  title: Java 路径无效
  description: 当前 Java 路径可能无效，请检查 Java 可执行文件是否存在 <span class="highlight"> {javaPath} </span>
launchJavaNoPermission:
  title: 无权限使用 Java
  description: 没有权限执行 <span class="highlight"> {javaPath} </span>，请尝试给启动器更高权限，给 Java 文件增加可执行权限，或换一个 Java。
launchNoProperJava:
  title: 没有合适的 Java
  description: 找不到合适的 Java 来启动游戏。({javaPath} 可能无效？)
launchNoVersionInstalled:
  title: 无法找到安装的 Minecraft
  description: 找不到 Minecraft 启动。当前版本是 <span class="highlight">{version}</span>。
unexpectedText: 这是意料之外的错误，你可以重启启动器来尝试缓解问题，请联系作者来修复。
</i18n>
