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
          class="visible-scroll flex max-h-[70vh] flex-col overflow-y-auto overflow-x-hidden"
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
          <div class="flex max-h-full flex-col overflow-y-auto">
            <LogView
              v-if="log"
              :logs="logs"
            />
            <pre class="mx-5 mb-5 overflow-auto rounded bg-[rgba(0,0,0,0.1)] p-5 hover:bg-[rgba(0,0,0,0.2)]">{{ content }}</pre>
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
  const lines = content.value.split('\n').map(l => l.replace('\r', ''))
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

watch(() => props.visible, (v) => {
  if (!v) {
    goBack()
  }
})
</script>

<style scoped>

</style>
