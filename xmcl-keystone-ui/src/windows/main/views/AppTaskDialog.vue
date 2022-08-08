<template>
  <v-dialog
    v-model="isShown"
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
        <v-icon>close</v-icon>
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
          <!-- <v-tab
            :key="1"
          >
            {{ $t('issue.name') }}
          </v-tab> -->
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
      </v-tab-item>
      <v-tab-item
        :key="1"
      >
        <app-task-dialog-issue-view />
      </v-tab-item>
    </v-tabs-items>
  </v-dialog>
</template>

<script lang=ts setup>
import { useDialog } from '../composables/dialog'
import AppTaskDialogIssueView from './AppTaskDialogIssues.vue'
import TaskView from './AppTaskDialogTaskView.vue'
import { useRouter } from '/@/composables'

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
