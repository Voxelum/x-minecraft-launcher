<template>
  <v-app ref="app" dark style="background: transparent; overflow: hidden">
    <universal-drop-view />
    <v-container
      v-if="loading"
      color="primary"
      align-center
      justify-center
      class="loading-background"
      style="position: absolute; width: 100%; height: 100%;"
    />
    <v-layout v-else fill-height>
      <side-bar :go-back="goBack" />
      <v-layout style="padding: 0; background: transparent; max-height: 100vh;" fill-height>
        <div class="main-body v-sheet" :class="{ solid: !blurMainBody }">
          <background />
          <transition name="fade-transition" mode="out-in">
            <router-view />
          </transition>
        </div>
      </v-layout>
      <context-menu />
      <search-bar />
      <notifier />
      <login-dialog />
      <task-dialog />
      <launch-status-dialog />
      <java-wizard-dialog />
    </v-layout>
  </v-app>
</template>

<script lang=ts>
import '/@/assets/common.css'

import {
  onMounted,
  reactive,
  toRefs,
  watch,
  defineComponent,
  ref,
  Ref,
  provide,
} from '@vue/composition-api'
import {
  useRouter,
  provideAsyncRoute,
  useBaseService,
  provideServerStatusCache,
useBackground,
} from '/@/hooks'
import { TASK_MANAGER, useTaskManager } from './provideTaskProxy'
import { provideDialog, provideNotifier, provideContextMenu, provideSearch, provideIssueHandler } from './hooks'
import LoginDialog from './dialog/BaseLoginDialog.vue'
import TaskDialog from './dialog/BaseTaskDialog.vue'
import LaunchStatusDialog from './dialog/BaseLaunchStatusDialog.vue'
import Particles from '../../components/Particles.vue'
import JavaWizardDialog from './dialog/BaseJavaWizardDialog.vue'
import { injection } from '/@/util/inject'
import { SYNCABLE_KEY } from '/@/hooks/useSyncable'
import Halo from '/@/components/Halo.vue'
import Background from './Background.vue'

export default defineComponent({
  components: { LoginDialog, TaskDialog, LaunchStatusDialog, JavaWizardDialog, Particles: (Particles as any), Halo, Background },
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

    const { syncing } = injection(SYNCABLE_KEY)
    const { state } = useBaseService()
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

    const data = reactive({
      loading: false,
    })

    watch(syncing, (v) => {
      if (!v && data.loading) {
        data.loading = false
      }
    })


    return {
      ...toRefs(data),
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

html ::-webkit-scrollbar {
  display: none;
}

::-webkit-scrollbar {
  display: unset;
}
</style>

<style scoped=true>
.main-body {
  /* min-width: 720px; */
  width: 100%;
  border-radius: 0px 2px 2px 0;
}
</style>
