<template>
  <v-tab-item>
    <div class="min-h-[420px] max-h-[70vh] overflow-auto visible-scroll">
      <transition
        name="fade-transition"
        mode="out-in"
        class="overflow-auto visible-scroll"
      >
        <v-list
          v-if="content === '' && files.length !== 0"
          :key="0"
          class="visible-scroll"
        >
          <v-list-item
            v-for="i in files"
            :key="i"
            v-ripple
            :disabled="pending"
            @click="openFile(i)"
          >
            <v-list-item-avatar>
              <v-icon>clear_all</v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ i }}</v-list-item-title>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                icon
                text
                @click.prevent.stop="showFile(i)"
              >
                <v-icon>folder</v-icon>
              </v-btn>
            </v-list-item-action>
            <v-list-item-action>
              <v-btn
                icon
                color="red"
                text
                @click.prevent.stop="removeFile(i)"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list>
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
                {{ $t('profile.logsCrashes.placeholder') }}
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
              {{ $t('back') }}
            </v-btn>
          </v-card-title>
          <log-view :logs="logs" />
        </div>
      </transition>
    </div>
  </v-tab-item>
</template>

<script lang=ts setup>
import { parseLog } from '/@/util/log'
import LogView from '/@/components/LogView.vue'

const props = defineProps<{
  files: string[]
  getFileContent(file: string): Promise<string>
  removeFile(file: string): Promise<void>
  showFile(file: string): void
  refreshing: boolean
}>()

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
</script>

<style scoped>

</style>
