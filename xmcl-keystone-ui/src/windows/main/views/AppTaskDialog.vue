<template>
  <v-dialog
    v-model="isShown"
    persistent
    hide-overlay
    width="700"
    style="max-height: 100%"
    class="task-dialog"
  >
    <v-toolbar
      tabs
    >
      <v-toolbar-title>{{ $t('task.manager') }}</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        @click="hide"
      >
        <v-icon>arrow_drop_down</v-icon>
      </v-btn>
      <template #extension>
        <v-tabs
          v-model="tabs"
          centered
        >
          <v-tab
            :key="0"
          >
            {{ $tc('task.name', 2) }}
          </v-tab>
          <v-tab
            :key="1"
          >
            {{ $t('issue.name') }}
          </v-tab>
          <!-- <v-tab
            :key="2"
          >
            {{ $t('notification.name') }}
          </v-tab> -->
        </v-tabs>
      </template>
    </v-toolbar>
    <v-tabs-items v-model="tabs">
      <v-tab-item
        :key="0"
      >
        <task-view />
        <div
          class="flex items-center justify-center w-full p-2 text-gray-400"
          :class="{ 'text-gray-400': speed !== 0, 'text-transparent': speed === 0 }"
        >
          <v-icon
            class="text-current mr-1"
          >
            downloading
          </v-icon>
          {{ speedText }}
        </div>
      </v-tab-item>
      <v-tab-item
        :key="1"
      >
        <app-task-dialog-issue-view />
      </v-tab-item>
      <!-- <v-tab-item
        :key="2"
      >
        <notification-view />
      </v-tab-item> -->
    </v-tabs-items>
  </v-dialog>
</template>

<script lang=ts setup>
import { useRouter } from '/@/composables'
import TaskView from './AppTaskDialogTaskView.vue'
import { DialogKey, useDialog } from '../composables/dialog'
import { useTasks } from '../composables/task'
import { getExpectedSize } from '/@/util/size'
import AppTaskDialogIssueView from './AppTaskDialogIssues.vue'

const { throughput } = useTasks()
const speed = ref(0)
const speedText = computed(() => getExpectedSize(speed.value) + '/s')
setInterval(() => {
  speed.value = throughput.value
  throughput.value = 0
}, 1000)

const { hide, isShown } = useDialog('task')
const router = useRouter()
const tabs = ref(0)

router.afterEach((g) => {
  if (isShown.value) {
    hide()
  }
})
</script>

<style scoped=true>
.v-progress-linear {
  margin-left: 10px;
}
</style>
<style>
.v-treeview-node__label {
  white-space: normal;
  line-break: normal;
  word-break: break-all;
}
.task-dialog .v-treeview > .v-treeview-node--leaf {
  margin-left: 0px;
}
</style>
