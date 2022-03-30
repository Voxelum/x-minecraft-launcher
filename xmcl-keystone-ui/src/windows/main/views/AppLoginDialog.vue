<template>
  <v-dialog
    v-model="isShown"
    width="550"
    :persistent="isPersistent"
    @dragover.prevent
  >
    <v-card
      class="login-card"
      @dragover.prevent
      @drop="onDrop"
    >
      <v-flex
        pa-4
        class="green justify-center relative items-center"
      >
        <div class="absolute flex justify-start w-full pl-4">
          <v-btn
            v-if="active !== LoginDialogLoginView"
            icon
            @click="route('back')"
          >
            <v-icon>arrow_back</v-icon>
          </v-btn>
        </div>
        <div>
          <transition
            name="fade-transition"
            mode="out-in"
          >
            <v-icon
              v-if="isLoginView"
              style="font-size: 50px"
            >
              person_pin
            </v-icon>
            <v-card-title
              v-else
            >
              {{ $t('user.service.title') }}
            </v-card-title>
          </transition>
        </div>
      </v-flex>

      <transition
        name="fade-transition"
        mode="out-in"
      >
        <component
          :is="active"
          :inside="inside"
          @route="route"
        />
      </transition>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { BaseServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import { IssueHandler, useService } from '/@/composables'
import { useDropLink } from '/@/composables/dropLink'
import LoginDialogLoginView from './AppLoginDialogForm.vue'
import LoginDialogUserServicesCard from './AppLoginDialogUserServicesCard.vue'
import StepperUserService from './AppLoginDialogUserServiceStepper.vue'
import { useDialog } from '../composables/dialog'

export default defineComponent({
  components: { LoginDialogLoginView, LoginDialogUserServicesCard, StepperUserService },
  setup() {
    const { hide, isShown, show, parameter } = useDialog('login')
    const active = ref(LoginDialogLoginView as any)
    const { inside } = useDropLink()

    // handle the not login issue
    const issueHandler = inject(IssueHandler)
    if (issueHandler) {
      issueHandler.userNotLogined = show
    }

    const { state } = useService(UserServiceKey)
    const userProfile = computed(() => state.users[state.selectedUser.id])
    const isLoginView = computed(() => active.value === LoginDialogLoginView)
    const isPersistent = computed(() => {
      if (userProfile.value?.accessToken) {
        return false
      }
      for (const user of Object.values(state.users)) {
        if (user.accessToken) {
          return false
        }
      }
      return true
    })
    const { handleUrl } = useService(BaseServiceKey)
    const onDrop = (e: DragEvent) => {
      const url = e.dataTransfer?.getData('xmcl/url')
      if (url) {
        handleUrl(url)
      }
      inside.value = false
    }
    const stack = [] as any[]
    const route = (route: string) => {
      if (route === 'back') {
        active.value = stack.pop() ?? LoginDialogLoginView
      } else if (route === 'profile') {
        stack.push(active.value)
        active.value = LoginDialogUserServicesCard
      } else if (route === 'edit-service') {
        stack.push(active.value)
        active.value = StepperUserService
      }
    }

    watch(isShown, (v) => {
      if (!v) {
        active.value = LoginDialogLoginView
        stack.splice(0, stack.length)
      }
    })

    return {
      isPersistent,
      LoginDialogLoginView,
      isLoginView,
      inside,
      onDrop,
      active,
      route,
      isShown,
    }
  },
})
</script>

<style>
.input-group {
  padding-top: 5px;
}
.password {
  padding-top: 5px;
}
.input-group--text-field label {
  top: 5px;
}

.login-card {
  padding-bottom: 25px;
}

.login-card .v-card__text {
  padding-left: 50px;
  padding-right: 50px;
  padding-bottom: 0px;
}
</style>
