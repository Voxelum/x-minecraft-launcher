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
          <!-- <v-tab
            :key="1"
          >
            {{ $t('issue.name') }}
          </v-tab>
          <v-tab
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
      <!-- <v-tab-item
        :key="1"
      >
        <issue-view />
      </v-tab-item>
      <v-tab-item
        :key="2"
      >
        <notification-view />
      </v-tab-item> -->
    </v-tabs-items>
  </v-dialog>
</template>

<script lang=ts>
import { useRouter } from '/@/composables'
import TaskView from './AppTaskDialogTaskView.vue'
import { DialogKey, useDialog } from '../composables/dialog'

export const TaskDialogKey: DialogKey<void> = 'task'

export default defineComponent({
  components: { TaskView },
  setup() {
    const { hide, isShown } = useDialog(TaskDialogKey)
    const router = useRouter()

    const data = reactive({
      tabs: 0,
    })

    router.afterEach((g) => {
      if (isShown.value) {
        hide()
      }
    })

    return {
      ...toRefs(data),
      isShown,
      hide,
    }
  },
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
