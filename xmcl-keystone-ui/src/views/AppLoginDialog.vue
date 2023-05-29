<template>
  <v-dialog
    v-model="isShown"
    width="550"
    :persistent="isPersistent"
    fullscreen
    transition="fade"
    @dragover.prevent
  >
    <v-card class="h-100vh moveable flex flex-grow flex-col items-center justify-center">
      <AppLoginDialogBackground
        :value="isShown"
        :seed="seed"
      />
      <AppLoginDialogForm
        ref="dialogRef"
        :inside="inside"
        @seed="seed++"
        @login="hide()"
      />
    </v-card>
    <v-btn
      outlined
      icon
      large
      class="non-moveable absolute right-20 top-20 z-20 border-2"
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
import AppLoginDialogBackground from './AppLoginDialogBackground.vue'
import AppLoginDialogForm from './AppLoginDialogForm.vue'

const { isShown, hide, dialog } = useDialog(LoginDialog)
const { inside } = useDropLink()
const dialogRef = ref<InstanceType<typeof AppLoginDialogForm>>()

// handle the not login issue
const { userProfile, select } = injection(kUserContext)

watch(isShown, (shown) => {
  if (!shown) { return }
  dialogRef.value?.reset(dialog.value.parameter
    ? {
      username: dialog.value.parameter.username,
      authority: dialog.value.parameter.service,
      error: dialog.value.parameter.error,
    }
    : undefined)
})

const seed = ref(0)

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
