<template>
  <v-tab-item>
    <div class="min-h-[420px]">
      <transition
        name="fade-transition"
        mode="out-in"
      >
        <VirtualList
          v-if="content === '' && files.length !== 0"
          :key="0"
          class="visible-scroll v-list overflow-auto h-full max-h-[70vh]"
          :data-component="HomeLogDialogTabItem"
          data-key="id"
          :data-sources="files.map((name, index) => ({ name, id: `${name}-${index}` }))"
          :estimate-size="60"
          :extra-props="{ openFile, removeFile, showFile, disabled: pending }"
        />
        <div
          v-else-if="content === '' && files.length === 0"
          style="height: 420px"
        >
          <v-container fill-height>
            <v-layout
              fill-height
              justify-center
              align-center
            >
              <h1 v-if="!pending">
                {{ t('logsCrashes.placeholder') }}
              </h1>
              <v-progress-circular
                v-else
                :size="100"
                color="white"
                indeterminate
              />
            </v-layout>
          </v-container>
        </div>
        <div
          v-else
          :key="1"
          class="visible-scroll overflow-y-auto overflow-x-hidden max-h-[70vh]"
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
          <log-view :logs="logs" />
        </div>
      </transition>
    </div>
  </v-tab-item>
</template>

<script lang=ts setup>
import { parseLog } from '@/util/log'
import LogView from '@/components/LogView.vue'
import VirtualList from 'vue-virtual-scroll-list'
import HomeLogDialogTabItem from './HomeLogDialogTabItem.vue'
import { useDialog } from '@/composables/dialog'

const props = defineProps<{
  files: string[]
  getFileContent(file: string): Promise<string>
  removeFile(file: string): Promise<void>
  showFile(file: string): void
  refreshing: boolean
}>()
const { isShown } = useDialog('log')

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

watch(isShown, (v) => {
  if (!v) {
    goBack()
  }
})
</script>

<style scoped>

</style>
