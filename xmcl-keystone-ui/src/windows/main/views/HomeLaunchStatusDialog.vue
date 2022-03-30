<template>
  <v-dialog
    v-model="isShown"
    :width="300"
    :persistent="status === 'launching'"
  >
    <v-card>
      <v-container>
        <v-layout
          align-center
          justify-center
          column
        >
          <v-flex>
            <v-progress-circular
              :size="70"
              :width="7"
              color="white"
              indeterminate
            />
          </v-flex>
          <v-flex mt-3>
            {{ progressText }}
          </v-flex>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { useI18n } from '/@/composables'
import { DialogKey, useDialog } from '../composables/dialog'
import { useLaunch } from '../composables/launch'

export const LaunchStatusDialogKey: DialogKey<void> = 'launch-status'

export default defineComponent({
  setup() {
    const progressText = ref('')
    const { $t } = useI18n()
    const { status } = useLaunch()
    const { isShown, show, hide } = useDialog(LaunchStatusDialogKey)
    onMounted(() => {
      watch(status, (s) => {
        switch (s) {
          case 'ready':
            hide()
            break
          case 'checkingProblems':
            show()
            progressText.value = $t('launch.checkingProblems')
            break
          case 'launching':
            show()
            progressText.value = $t('launch.launching')
            setTimeout(() => { progressText.value = $t('launch.launchingSlow') }, 4000)
            break
          case 'minecraftReady':
            hide()
            break
          default:
        }
      })
    })
    return {
      progressText,
      status,
      isShown,
    }
  },
})
</script>

<style>
</style>
