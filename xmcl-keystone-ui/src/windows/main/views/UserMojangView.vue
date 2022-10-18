<template>
  <div>
    <div
      v-if="!security"
    >
      <v-alert
        :value="!security"
        style="cursor: pointer;"
        @click="isChallengesDialogShown = true"
      >
        {{ t('user.insecureClient') }}
      </v-alert>
      <v-dialog
        v-model="isChallengesDialogShown"
        width="500"
      >
        <challenges-form :show="isChallengesDialogShown" />
      </v-dialog>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { useMojangSecurityStatus } from '../composables/user'

import { UserProfile } from '@xmcl/runtime-api'

const props = defineProps<{ user: UserProfile }>()
const { security } = useMojangSecurityStatus()
const { t } = useI18n()
const isChallengesDialogShown = ref(false)
</script>
