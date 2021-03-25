import { defineComponent, h } from '@vue/composition-api'

import BaseJavaWizardDialog from './BaseJavaWizardDialog.vue'
import BaseLoginDialog from './BaseLoginDialog.vue'
import BaseTaskDialogIssueView from './BaseTaskDialogIssueView.vue'
import BaseTaskDialogTaskView from './BaseTaskDialogTaskView.vue'
import BaseLaunchStatusDialog from './BaseLaunchStatusDialog.vue'
import BaseTaskDialog from './BaseTaskDialog.vue'
import BaseTaskDialogNotificationView from './BaseTaskDialogNotificationView.vue'
import DialogDownloadMissingServerMods from './DialogDownloadMissingServerMods.vue'

const components = {
  BaseJavaWizardDialog,
  BaseLoginDialog,
  BaseTaskDialogIssueView,
  BaseTaskDialogTaskView,
  BaseLaunchStatusDialog,
  BaseTaskDialog,
  BaseTaskDialogNotificationView,
  DialogDownloadMissingServerMods,
}

export default defineComponent({
  components,
  setup() {
    return () => h('div', { staticStyle: { 'z-index': 10 } }, components.map((c: any) => h(c)))
  },
})
