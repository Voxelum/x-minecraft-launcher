<template>
  <v-dialog
    v-model="isShown"
    :width="300"
    :persistent="status === 'launching'"
  >
    <v-card dark>
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
import { ref, onMounted, watch, defineComponent } from '@vue/composition-api'
import { useLaunch, useI18n } from '/@/hooks'
import { useDialog } from '../hooks'

export default defineComponent({
  setup() {
    const progressText = ref('')
    const { $t } = useI18n()
    const { status } = useLaunch()
    const { isShown, show, hide } = useDialog('launch-status')
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
