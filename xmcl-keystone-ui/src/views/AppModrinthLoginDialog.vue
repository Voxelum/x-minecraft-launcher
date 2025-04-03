<template>
  <SimpleDialog v-model="isShown" :title="t('modrinth.loginTitle')" :width="400" color="primary" confirm-icon="check" :confirm="t('yes')" @confirm="onAccept" @cancel="rejectSignal()">
    <div class="flex flex-col items-center gap-4 mt-2">
      <v-icon size="100" color="green">
        $vuetify.icons.modrinth
      </v-icon>
      <span>
        {{ t('modrinth.loginHint') }}
      </span>
    </div>
  </SimpleDialog>
</template>
<script setup lang="ts">
import SimpleDialog from '@/components/SimpleDialog.vue'
import { useDialog } from '@/composables/dialog'
import { kModrinthAuthenticatedAPI } from '@/composables/modrinthAuthenticatedAPI'
import { injection } from '@/util/inject'

const { t } = useI18n()

const { acceptSignal, rejectSignal } = injection(kModrinthAuthenticatedAPI)

function onAccept() {
  isShown.value = false
  acceptSignal()
}

const { isShown } = useDialog('modrinth-login')
</script>