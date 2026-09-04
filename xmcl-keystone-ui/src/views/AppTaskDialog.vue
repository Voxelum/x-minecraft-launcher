<template>
  <v-dialog
    v-model="isShown"
    hide-overlay
    width="700"
    style="max-height: 100%"
    class="task-dialog"
  >
    <TaskView />
  </v-dialog>
</template>

<script lang=ts setup>
import { useDialog } from '../composables/dialog'
import TaskView from './AppTaskDialogTaskView.vue'
import { onScopeDispose } from 'vue'

const { hide, isShown } = useDialog('task', () => {
  windowController.focus()
})
const router = useRouter()
const removeAfterEach = router.afterEach(() => {
  if (isShown.value) {
    hide()
  }
})
onScopeDispose(removeAfterEach)
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
