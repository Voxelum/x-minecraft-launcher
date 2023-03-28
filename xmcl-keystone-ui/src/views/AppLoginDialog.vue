<template>
  <v-dialog
    v-model="isShown"
    width="550"
    :persistent="isPersistent"
    fullscreen
    transition="fade"
    @dragover.prevent
  >
    <v-card>
      <LoginDialogLoginView
        :inside="inside"
      />
    </v-card>
    <v-btn
      outlined
      icon
      large
      class="absolute top-20 right-20 z-20 border-2 non-moveable z-10"
      @click="isShown = false"
    >
      <v-icon>close</v-icon>
    </v-btn>
  </v-dialog>
</template>

<script lang=ts setup>
import { useDropLink } from '@/composables/dropLink'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import { useDialog } from '../composables/dialog'
import { LoginDialog } from '../composables/login'
import LoginDialogLoginView from './AppLoginDialogForm.vue'

const { isShown } = useDialog(LoginDialog)
const { inside } = useDropLink()

// handle the not login issue

const { userProfile } = injection(kUserContext)

const isPersistent = computed(() => {
  if (userProfile.value?.invalidated) {
    return false
  }
  return true
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
</style>
