<template>
  <v-app
    ref="app"
    dark
    class="bg-[#424242] flex flex-col overflow-auto h-full"
  >
    <div
      topbar
      class="flex w-full moveable bg-[#424242] p-0 flex-grow-0"
    >
      <span class="p-0 flex flex-shrink flex-grow-0">
        <v-icon
          v-ripple
          dark
          small
          class="flex items-center py-2 hover:bg-[rgba(255,255,255,0.2)] cursor-pointer select-none non-moveable"
          style="width: 80px;"
          @click="goBack"
        >
          arrow_back
        </v-icon>
      </span>
      <div class="flex-grow " />
      <top-window-controls />
    </div>
    <div
      class="flex flex-grow h-full overflow-auto relative"
    >
      <side-bar />
      <div
        class="flex top-0 bottom-0 right-0 overflow-auto max-h-full absolute"
        style="left: 80px;"
        :class="{ solid: !blurMainBody }"
      >
        <background />
        <transition
          name="fade-transition"
          mode="out-in"
        >
          <router-view />
        </transition>
      </div>
    </div>
    <universal-drop-view />
    <context-menu />
    <search-bar />
    <notifier />
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
import TopWindowControls from './components/TopWindowControls.vue'
import UniversalDropView from './components/UniversalDropView.vue'
import { provideContextMenu, provideDialog, provideIssueHandler, provideNotifier, provideSearch } from './composables'
import { TASK_MANAGER, useTaskManager } from './provideTaskProxy'
import '/@/assets/common.css'
import ContextMenu from '/@/components/ContextMenu.vue'
import {
  provideAsyncRoute, provideServerStatusCache,
  useBackground, useRouter,
} from '/@/hooks'
export default defineComponent({
  components: { LoginDialog, TaskDialog, LaunchStatusDialog, JavaFixerDialog, Background, Notifier, ContextMenu, SearchBar, UniversalDropView, SideBar, AddInstanceDialog, TopWindowControls },
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

    function goBack() {
      router.back()
    }

    router.afterEach((to) => {
      onHomePage.value = to.path === '/'
      toggle(true)
      text.value = ''
    })

    return {
      app,
      goBack,
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
