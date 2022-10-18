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
      <v-toolbar-title>{{ t('task.manager') }}</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        @click="hide"
      >
        <v-icon>close</v-icon>
      </v-btn>
    </v-toolbar>
    <task-view />
  </v-dialog>
</template>

<script lang=ts setup>
import { useDialog } from '../composables/dialog'
import TaskView from './AppTaskDialogTaskView.vue'

const { hide, isShown } = useDialog('task')
const router = useRouter()
const { t } = useI18n()

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
