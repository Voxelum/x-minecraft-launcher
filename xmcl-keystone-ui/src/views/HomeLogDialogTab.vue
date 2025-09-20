<template>
  <v-tab-item>
    <div class="min-h-[420px]">
      <Transition
        name="fade-transition"
        mode="out-in"
      >
        <v-virtual-scroll
          v-if="content === '' && files.length !== 0"
          :key="0"
          class="visible-scroll v-list h-full max-h-[70vh] overflow-auto"
          :bench="10"
          :items="files.map((name, index) => ({ name, id: `${name}-${index}` }))"
          :item-height="60"
        >
          <template #default="{ item }">
            <HomeLogDialogTabItem
              :source="item"
              :open-file="openFile"
              :remove-file="removeFile"
              :show-file="showFile"
              :disabled="pending"
            />
          </template>
        </v-virtual-scroll>
        <div
          v-else-if="content === '' && files.length === 0"
          style="height: 420px"
        >
          <div class="flex h-full items-center justify-center">
            <h1 v-if="!pending">
              {{ t('logsCrashes.placeholder') }}
            </h1>
            <v-progress-circular
              v-else
              :size="100"
              color="white"
              indeterminate
            />
          </div>
        </div>
        <div
          v-else
          :key="1"
          class="flex flex-col overflow-y-auto visible-scroll max-h-[70vh] overflow-x-hidden"
        >
          <v-card-title primary-title>
            {{ showedFile }}
            <v-spacer />
            <v-btn
              text
              @click="goBack"
            >
              <v-icon left>
                arrow_back
              </v-icon>
              {{ t('back') }}
            </v-btn>
          </v-card-title>
          <LogView
            class="max-h-[50vh] overflow-auto"
            v-if="log"
            :logs="logs"
          />
          <div v-else class="overflow-auto mx-5 mb-5 grid grid-cols-4 gap-6">
            <pre class="col-span-3 overflow-auto rounded bg-[rgba(0,0,0,0.1)] p-5 hover:bg-[rgba(0,0,0,0.2)]">{{ content }}</pre>
            <AppCrashAIHint
              class="col-span-1"
              :useCNAI="useCNAI"
              :getPrompt="getPrompt"
            />
          </div>
        </div>
      </Transition>
    </div>
  </v-tab-item>
</template>

<script lang=ts setup>
import { parseLog } from '@/util/log'
import LogView from '@/components/LogView.vue'
import HomeLogDialogTabItem from './HomeLogDialogTabItem.vue'
import AppCrashAIHint from '@/components/AppCrashAIHint.vue';
import { kEnvironment } from '@/composables/environment';
import { kSettingsState } from '@/composables/setting';
import { getCrashPrompt } from '@/util/crashPrompt';
import { injection } from '@/util/inject';

const props = defineProps<{
  files: string[]
  log?: boolean
  getFileContent(file: string): Promise<string>
  removeFile(file: string): Promise<void>
  showFile(file: string): void
  visible: boolean
  refreshing: boolean
}>()

const { t } = useI18n()
const content = ref('')
const loading = ref(false)
const showedFile = ref('')
const goBack = () => {
  content.value = ''
  showedFile.value = ''
}
const openFile = async (name: string) => {
  loading.value = true
  showedFile.value = name
  content.value = await props.getFileContent(name).finally(() => { loading.value = false })
}
const pending = computed(() => props.refreshing || loading.value)
const logs = computed(() => {
  const lines = content.value.split(/[\r?\n]/g)
  const logLines = [] as string[]
  for (const line of lines) {
    if (line.startsWith('[')) {
      logLines.push(line)
    } else {
      logLines[logLines.length - 1] += '\n' + line
    }
  }
  return logLines.map(parseLog)
})


const env = injection(kEnvironment)
const useCNAI = computed(() => {
  return env.value?.gfw || env.value?.region === 'zh-CN'
})

const { state } = injection(kSettingsState)
function getPrompt(raw?: boolean) {
  if (raw) {
    return content.value
  }
  return getCrashPrompt(useCNAI.value, content.value, '', state.value?.locale || 'en-US')
}

watch(() => props.visible, (v) => {
  if (!v) {
    goBack()
  }
})
</script>

<style scoped>

</style>
