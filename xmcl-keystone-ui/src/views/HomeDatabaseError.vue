<template>
  <v-card
    v-if="error"
    class="mx-2"
    color="red"
  >
    <v-card-text>
      {{ error }}
    </v-card-text>
    <v-card-actions>
      <v-btn
        text
        @click="push('/setting')"
      >
        <v-icon left>
          settings
        </v-icon>
        {{ t('setting.name', 2) }}
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import { kDatabaseStatus } from '@/composables/databaseStatus'
import { injection } from '@/util/inject'

const { t } = useI18n()
const { isOpened } = injection(kDatabaseStatus)
const { push } = useRouter()
const error = computed(() => {
  if (!isOpened.value) {
    return t('errors.DatabaseNotOpened')
  }
  return ''
})
</script>
