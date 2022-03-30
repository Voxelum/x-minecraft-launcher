<template>
  <v-app
    ref="app"
    class="overflow-auto h-full overflow-x-hidden"
  >
    <system-bar />
    <div
      class="flex h-full overflow-auto relative"
    >
      <side-bar />
      <main
        class="flex top-0 bottom-0 right-0 overflow-auto max-h-full absolute left-[80px]"
        :class="{ solid: !blurMainBody }"
      >
        <background />
        <transition
          name="fade-transition"
          mode="out-in"
        >
          <router-view class="z-2" />
        </transition>
      </main>
    </div>
    <universal-drop-view />
    <context-menu />
    <search-bar />
    <notifier />
    <feedback-dialog />
    <login-dialog />
    <task-dialog />
    <add-instance-dialog />
    <add-server-dialog />
    <export-dialog />
  </v-app>
</template>

<script lang=ts setup>
import { Ref } from '@vue/composition-api'
import '/@/assets/common.css'
import ContextMenu from '/@/components/ContextMenu.vue'
import { provideAsyncRoute, useRouter } from '/@/composables'
import SearchBar from './components/SearchBar.vue'
import { useBackground } from './composables/background'
import { provideDialog } from './composables/dialog'
import { provideIssueHandler } from './composables/issueHandler'
import { provideNotifier } from './composables/notifier'
import { provideServerStatusCache } from './composables/serverStatus'
import { provideSearch } from './composables/useSearch'
import { TASK_MANAGER, useTaskManager } from './provideTaskProxy'
import AddInstanceDialog from './views/AppAddInstanceDialog.vue'
import AddServerDialog from './views/AppAddServerDialog.vue'
import Background from './views/AppBackground.vue'
import UniversalDropView from './views/AppDropDialog.vue'
import FeedbackDialog from './views/AppFeedbackDialog.vue'
import LoginDialog from './views/AppLoginDialog.vue'
import Notifier from './views/AppNotifier.vue'
import SideBar from './views/AppSideBar.vue'
import ExportDialog from './views/AppExportDialog.vue'
import SystemBar from './views/AppSystemBar.vue'
import TaskDialog from './views/AppTaskDialog.vue'

provideDialog()
provideNotifier()

const taskManager = useTaskManager()
provide(TASK_MANAGER, taskManager)
const { blurMainBody } = useBackground()

provideAsyncRoute()
provideServerStatusCache()
provideIssueHandler()

const { text, toggle } = provideSearch()

const router = useRouter()
const onHomePage = ref(router.currentRoute.path === '/')
const app: Ref<any> = ref(null)

router.afterEach((to) => {
  onHomePage.value = to.path === '/'
  toggle(true)
  text.value = ''
})
</script>

<style>
.clip-head {
  clip-path: inset(0px 30px 30px 0px) !important;
  width: 64px;
  height: auto; /*to preserve the aspect ratio of the image*/
}
.v-input__icon--prepend {
  margin-right: 7px;
}
img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
</style>

<style scoped=true>
</style>
