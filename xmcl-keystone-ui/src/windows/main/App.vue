<template>
  <v-app
    v-if="!shouldSetup"
    ref="app"
    class="overflow-auto h-full overflow-x-hidden max-h-[100vh]"
    :class="{ 'dark': vuetify.theme.dark }"
    :style="cssVars"
  >
    <background />
    <system-bar />
    <div
      class="flex h-full overflow-auto relative"
    >
      <side-bar />
      <main
        class="flex top-0 bottom-0 right-0 overflow-auto max-h-full relative"
        :class="{ solid: !blurMainBody }"
      >
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
    <notifier />
    <feedback-dialog />
    <login-dialog />
    <task-dialog />
    <add-instance-dialog />
    <add-server-dialog />
    <export-dialog />
    <app-share-instance-dialog />
    <app-instance-delete-dialog />
  </v-app>
  <v-app
    v-else
    class="overflow-auto h-full overflow-x-hidden max-h-[100vh]"
    :class="{ 'dark': vuetify.theme.dark }"
    :style="cssVars"
  >
    <system-bar />
    <div
      class="flex h-full overflow-auto relative"
    >
      <setup @ready="shouldSetup = false" />
    </div>
    <feedback-dialog />
  </v-app>
</template>

<script lang=ts setup>
import { Ref } from 'vue'
import ContextMenu from './components/ContextMenu.vue'
import { useAuthProfileImportNotification } from './composables/authProfileImport'
import { useBackground } from './composables/background'
import { useColorTheme } from './composables/colorTheme'
import { provideDialog } from './composables/dialog'
import { useDefaultErrorHandler } from './composables/errorHandler'
import { provideNotifier } from './composables/notifier'
import { provideServerStatusCache } from './composables/serverStatus'
import { TASK_MANAGER, useTaskManager } from './provideTaskProxy'
import AddInstanceDialog from './views/AppAddInstanceDialog.vue'
import AddServerDialog from './views/AppAddServerDialog.vue'
import Background from './views/AppBackground.vue'
import UniversalDropView from './views/AppDropDialog.vue'
import ExportDialog from './views/AppExportDialog.vue'
import FeedbackDialog from './views/AppFeedbackDialog.vue'
import LoginDialog from './views/AppLoginDialog.vue'
import Notifier from './views/AppNotifier.vue'
import AppShareInstanceDialog from './views/AppShareInstanceDialog.vue'
import SideBar from './views/AppSideBar.vue'
import SystemBar from './views/AppSystemBar.vue'
import TaskDialog from './views/AppTaskDialog.vue'
import Setup from './views/Setup.vue'
import '/@/assets/common.css'
import { IssueHandler, IssueHandlerKey, provideAsyncRoute, useRouter /* provideSearchToggle */ } from '/@/composables'
import { useDropService } from '/@/composables/dropService'
import { ExceptionHandlersKey, useExceptionHandlers } from '/@/composables/exception'
import { VuetifyInjectionKey } from '/@/composables/vuetify'
import { injection } from '/@/util/inject'
import AppInstanceDeleteDialog from './views/AppInstanceDeleteDialog.vue'

const { primaryColor, accentColor, infoColor, errorColor, successColor, warningColor, backgroundColor } = useColorTheme()
const vuetify = injection(VuetifyInjectionKey)

const cssVars = computed(() => ({
  '--primary': primaryColor.value,
  'background-color': backgroundColor.value,
}))

const shouldSetup = ref(location.search.indexOf('setup') !== -1)

if (primaryColor.value) { vuetify.theme.currentTheme.primary = primaryColor.value }
// if (secondaryColor.value) { vuetify.theme.currentTheme.secondary = secondaryColor.value }
if (accentColor.value) { vuetify.theme.currentTheme.accent = accentColor.value }
if (infoColor.value) { vuetify.theme.currentTheme.info = infoColor.value }
if (errorColor.value) { vuetify.theme.currentTheme.error = errorColor.value }
if (successColor.value) { vuetify.theme.currentTheme.success = successColor.value }
if (warningColor.value) { vuetify.theme.currentTheme.warning = warningColor.value }

watch(primaryColor, (newColor) => { vuetify.theme.currentTheme.primary = newColor })
// watch(secondaryColor, (newColor) => { vuetify.theme.currentTheme.secondary = newColor })
watch(accentColor, (newColor) => { vuetify.theme.currentTheme.accent = newColor })
watch(infoColor, (newColor) => { vuetify.theme.currentTheme.info = newColor })
watch(errorColor, (newColor) => { vuetify.theme.currentTheme.error = newColor })
watch(successColor, (newColor) => { vuetify.theme.currentTheme.success = newColor })
watch(warningColor, (newColor) => { vuetify.theme.currentTheme.warning = newColor })

provide(ExceptionHandlersKey, useExceptionHandlers())
useDropService()
provideDialog()
provideNotifier()
useDefaultErrorHandler()

useAuthProfileImportNotification()

const taskManager = useTaskManager()
provide(TASK_MANAGER, taskManager)
const { blurMainBody } = useBackground()

provideAsyncRoute()
provideServerStatusCache()
provide(IssueHandlerKey, new IssueHandler())

const router = useRouter()
const onHomePage = ref(router.currentRoute.path === '/')
const app: Ref<any> = ref(null)

router.afterEach((to) => {
  onHomePage.value = to.path === '/'
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
