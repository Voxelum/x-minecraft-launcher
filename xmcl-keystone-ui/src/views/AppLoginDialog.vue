<template>
  <v-dialog
    v-model="isShown"
    width="550"
    :persistent="isPersistent"
    fullscreen
    transition="fade"
    @dragover.prevent
  >
    <v-card
      @dragover.prevent
      @drop="onDrop"
    >
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
import { useService } from '@/composables'
import { useDropLink } from '@/composables/dropLink'
import { useCurrentUser } from '@/composables/user'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { LoginDialog } from '../composables/login'
import LoginDialogLoginView from './AppLoginDialogForm.vue'

const { isShown } = useDialog(LoginDialog)
const { inside } = useDropLink()

// handle the not login issue

const { userProfile } = useCurrentUser()

const isPersistent = computed(() => {
  if (userProfile.value?.accessToken) {
    return false
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
