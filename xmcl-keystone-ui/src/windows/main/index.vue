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
          <router-view />
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
    <launch-status-dialog />
    <java-fixer-dialog />
    <add-instance-dialog />
  </v-app>
</template>

<script lang=ts>
import {
  defineComponent, provide, ref,
  Ref, toRefs,
} from '@vue/composition-api'
import AddInstanceDialog from './components/AddInstanceDialog.vue'
import Background from './components/Background.vue'
import JavaFixerDialog from './components/JavaFixerDialog.vue'
import LaunchStatusDialog from './components/LaunchStatusDialog.vue'
import LoginDialog from './components/LoginDialog.vue'
import Notifier from './components/Notifier.vue'
import SearchBar from './components/SearchBar.vue'
import SideBar from './components/SideBar.vue'
import TaskDialog from './components/TaskDialog.vue'
import UniversalDropView from './components/UniversalDropView.vue'
import { provideContextMenu, provideDialog, provideIssueHandler, provideNotifier, provideSearch } from './composables'
import { TASK_MANAGER, useTaskManager } from './provideTaskProxy'
import '/@/assets/common.css'
import ContextMenu from '/@/components/ContextMenu.vue'
import {
  provideAsyncRoute, provideServerStatusCache,
  useBackground, useRouter,
} from '/@/hooks'
import FeedbackDialog from './pages/FeedbackDialog.vue'
import SystemBar from './components/SystemBar.vue'

export default defineComponent({
  components: { LoginDialog, TaskDialog, LaunchStatusDialog, JavaFixerDialog, Background, Notifier, ContextMenu, SearchBar, UniversalDropView, SideBar, AddInstanceDialog, FeedbackDialog, SystemBar },
  setup() {
    provideDialog()
    provideNotifier()

    const taskManager = useTaskManager()
    provide(TASK_MANAGER, taskManager)
    const { blurMainBody } = useBackground()

    provideAsyncRoute()
    provideServerStatusCache()
    provideIssueHandler()

    const { text, toggle } = provideSearch()
    provideContextMenu()

    const router = useRouter()
    const onHomePage = ref(router.currentRoute.path === '/')
    const app: Ref<any> = ref(null)

    router.afterEach((to) => {
      onHomePage.value = to.path === '/'
      toggle(true)
      text.value = ''
    })

    return {
      app,
      blurMainBody,
    }
  },
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
