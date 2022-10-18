<template>
  <v-app class="h-full overflow-auto relative max-h-[100vh]">
    <v-card
      class="h-full flex flex-col overflow-auto"
    >
      <v-toolbar
        class="moveable w-full"
        flat
      >
        <v-app-bar-nav-icon />
        <v-toolbar-title>{{ t('title') }}</v-toolbar-title>
        <v-spacer />
        <v-btn
          icon
          class="non-moveable"
          @click="changeTheme"
        >
          <v-icon>
            {{ themeIcon }}
          </v-icon>
        </v-btn>
        <v-btn
          icon
          class="non-moveable"
          @click="close"
        >
          <v-icon>
            close
          </v-icon>
        </v-btn>
        <template #extension>
          <v-tabs
            v-model="tab"
            align-with-title
            class="non-moveable"
          >
            <v-tabs-slider color="yellow" />

            <v-tab
              v-for="item in Object.keys(logsRecord)"
              :key="item"
            >
              Minecraft {{ item }}
            </v-tab>
          </v-tabs>
        </template>
      </v-toolbar>
      <v-tabs-items
        v-model="tab"
        class="flex-grow h-full overflow-auto"
      >
        <v-tab-item
          v-for="item in Object.entries(logsRecord)"
          :key="item[0]"
          class="flex-grow h-full overflow-auto"
        >
          <log-view
            class="flex-grow h-full overflow-auto"
            :logs="item[1]"
          />
        </v-tab-item>
      </v-tabs-items>
    </v-card>
  </v-app>
</template>

<script lang=ts setup>
import { set } from 'vue'

import { baseService } from './baseService'
import LogView from '@/components/LogView.vue'
import { LogRecord, parseLog } from '@/util/log'

export interface Log extends LogRecord {
  id: number
}

const { t } = useI18n()
const { hide } = windowController
const logsRecord: Record<number, Log[]> = reactive({})
const tab = ref(0)

// window.location.search.
const currentTheme = ref('dark' as 'dark' | 'light' | 'system')

watch(currentTheme, (val) => {
  baseService.commit('themeSet', val)
})

const iconSets = {
  dark: 'dark_mode',
  light: 'light_mode',
  system: 'settings_brightness',
}
const themeIcon = computed(() => iconSets[currentTheme.value])
function accept(pid: number, log: string) {
  let logs: Log[]
  if (logsRecord[pid]) {
    logs = logsRecord[pid]
  } else {
    logs = set(logsRecord, pid, [])
  }
  // console.log(log)
  if (log.startsWith('[')) {
    logs.push({
      ...parseLog(log),
      id: logs.length,
    })
  } else {
    const trimmed = log.trim()
    if (trimmed.startsWith('<')) {
      let timestamp = /timestamp="(.+?)"/g.exec(trimmed)?.[1]
      const level = /level="(.+?)"/g.exec(trimmed)?.[1]
      const thread = /thread="(.+?)"/g.exec(trimmed)?.[1]
      const text = /<!\[CDATA\[(.+?)\]\]>/g.exec(trimmed)?.[1]
      timestamp = timestamp ? new Date(Number.parseInt(timestamp)).toLocaleString() : ''
      logs.push({
        tags: [],
        date: timestamp,
        level: level || '',
        content: text || '',
        source: thread || '',
        raw: trimmed,
        id: logs.length,
      })
    } else {
      const last = logs[logs.length - 1]
      const buffer = last?.raw + '\n' + log
      logs[logs.length - 1] = {
        ...parseLog(buffer),
        id: logs.length,
      }
    }
  }
}
onMounted(() => {
  gameMonitor.on('minecraft-stderr', (event) => {
    const { stderr, pid } = event
    accept(pid, stderr)
  })
  gameMonitor.on('minecraft-stdout', (event) => {
    const { stdout, pid } = event
    accept(pid, stdout)
  })
})
function changeTheme() {
  if (currentTheme.value === 'dark') {
    currentTheme.value = 'light'
  } else if (currentTheme.value === 'light') {
    currentTheme.value = 'system'
  } else if (currentTheme.value === 'system') {
    currentTheme.value = 'dark'
  }
}
function onClick(log: Log) {
  navigator.clipboard.writeText(log.raw)
}
function close() {
  hide()
}
</script>

<style>
.moveable {
  -webkit-app-region: drag;
  user-select: none;
}

.non-moveable {
  -webkit-app-region: no-drag;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.01s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
.v-list__tile__content {
  margin-left: 7px;
}
.v-list__tile__title {
  overflow-x: auto;
  text-overflow: unset;
}
</style>
