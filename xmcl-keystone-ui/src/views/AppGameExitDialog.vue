<template>
  <v-dialog
    v-model="data.isShown"
    :persistent="true"
  >
    <v-card class="visible-scroll flex max-h-[80vh] flex-col overflow-auto">
      <v-toolbar color="error">
        <v-toolbar-title
          class="white--text"
        >
          {{ data.isCrash ? t('launchFailed.crash') : t('launchFailed.title') }}
        </v-toolbar-title>
        <v-spacer />
        <v-toolbar-items v-if="!data.launcherError">
          <v-btn
            text
            @click="openFolder"
          >
            {{ data.isCrash ? t('instance.openCrashReportFolder') : t('instance.openLogFolder') }}
          </v-btn>
        </v-toolbar-items>
        <v-btn
          icon
          @click="data.isShown=false"
        >
          <v-icon>arrow_drop_down</v-icon>
        </v-btn>
      </v-toolbar>
      <v-card-text class="grid grid-cols-12 overflow-auto gap-4">
        <div class="col-span-9 flex flex-col overflow-auto">
          <div
            v-if="data.errorLog"
            style="padding: 10px"
          >
            {{ data.launcherError ? t('launchFailed.failedToLaunch') : data.isCrash ? t(`launchFailed.crash`) : t(`launchFailed.description`) }}
          </div>
          <pre
            v-if="data.errorLog"
            class="overflow-auto min-h-[200px] rounded bg-[rgba(0,0,0,0.1)] p-5 hover:bg-[rgba(0,0,0,0.2)]"
          >{{ data.errorLog }}</pre>
          <div
            style="padding: 10px"
          >
            {{ t(`launchFailed.latestLog`) }}
          </div>
          <pre class="overflow-auto rounded bg-[rgba(0,0,0,0.1)] p-5 hover:bg-[rgba(0,0,0,0.2)]">{{ data.log }}</pre>
        </div>
        <div class="col-span-3 mt-2 items-center justify-center flex flex-col gap-6 select-none">
          <v-icon size="60">
            hail
          </v-icon>
          <span class="text-lg">
            {{ t('askAICrash.description') }}
          </span>
          <ol>
            <li>
              {{ t('askAICrash.copyPrompt') }}
              <v-btn color="primary" :outlined="copied" small @click="onCopyPrompt">
                <v-icon left>
                  {{ copied ? 'check' : 'smart_toy'}}
                </v-icon>
                {{ t( 'copyClipboard.success' )}}
              </v-btn>
            </li>
            <li>
              {{ t('askAICrash.selectPlatform') }}
              <ul>
                <template v-if="useCNAI">
                  <li><a href="https://chatglm.cn/share/kFiK3rVp" @click="onGMLClicked">GLM</a></li>
                  <li><a href="https://doubao.com/chat">豆包</a></li>
                  <li><a href="https://chat.deepseek.com/">Deepseek</a></li>
                </template>
                <template v-else>
                  <li><a href="https://chat.openai.com">ChatGPT</a></li>
                  <li><a href="https://gemini.google.com">Gemini</a></li>
                  <li><a href="https://chat.deepseek.com/">Deepseek</a></li>
                  <li><a href="https://chat.z.ai">z.ai</a></li>
                </template>
              </ul>
            </li>
          </ol>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import { useService } from '@/composables'
import { kEnvironment } from '@/composables/environment'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kSettingsState } from '@/composables/setting'
import { getCrashPrompt } from '@/util/crashPrompt'
import { injection } from '@/util/inject'
import { BaseServiceKey, InstanceLogServiceKey, LaunchServiceKey } from '@xmcl/runtime-api'

const data = reactive({
  isShown: false,
  log: '',
  isCrash: false,
  launcherError: false,
  crashReportLocation: '',
  errorLog: '',
})
watch(() => data.isShown, (isShown) => {
  if (!isShown) {
    data.log = ''
    data.isCrash = false
    data.launcherError = false
    data.crashReportLocation = ''
    data.errorLog = ''
  }
})
const { t } = useI18n()
const { path } = injection(kInstance)
const { getLogContent, getCrashReportContent, showLog } = useService(InstanceLogServiceKey)
const { on } = useService(LaunchServiceKey)
const { showItemInDirectory } = useService(BaseServiceKey)
const { error } = injection(kInstanceLaunch)

watch(error, (e) => {
  if (!e) return
  data.launcherError = true
  data.errorLog = JSON.stringify(e, null, 2)
})
function decorate(log: string) {
  return log
}
async function displayLog() {
  const log = await getLogContent(path.value, 'latest.log')
  data.log = decorate(log)
  data.isShown = true
}
async function displayCrash() {
  const log = await getCrashReportContent(path.value, data.crashReportLocation)
  data.log = decorate(log)
  data.isShown = true
}
on('minecraft-exit', ({ code, signal, crashReport, crashReportLocation, errorLog }) => {
  if (!code && signal === 'SIGTERM') {
    return
  }
  if (code !== 0) {
    data.errorLog = errorLog || crashReport || ''
    if (crashReportLocation) {
      data.crashReportLocation = crashReportLocation
      data.isCrash = true
      displayCrash()
    } else {
      displayLog()
    }
  }
})
function openFolder() {
  if (data.isCrash) {
    showItemInDirectory(data.crashReportLocation)
  } else {
    showLog(path.value, 'latest.log')
  }
}

const env = injection(kEnvironment)
const useCNAI = computed(() => {
  console.log(env.value?.region)
  return env.value?.gfw || env.value?.region === 'zh-CN'
})

const copied = ref(false)
const { state } = injection(kSettingsState)
function onCopyPrompt() {
  const useCN = useCNAI.value
  const prompt = getCrashPrompt(useCN, data.errorLog, data.log, state.value?.locale || 'en-US')
  windowController.writeClipboard(prompt)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function onGMLClicked() {
  windowController.writeClipboard(data.errorLog)
}
</script>

<style>
</style>
