<template>
  <v-dialog
    v-model="isShown"
    persistent
  >
    <v-card v-if="migrateState === 0">
      <v-card-title>
        <h2 style="display: block; min-width: 100%">
          {{ $t("setting.setRootTitle") }}
        </h2>
        <v-text-field
          :value="root"
          readonly
          hide-details
        />
      </v-card-title>
      <v-card-text>
        <p>{{ $t("setting.setRootDescription") }}</p>
        <p>{{ $t("setting.setRootCause") }}</p>
      </v-card-text>
      <v-divider />
      <v-card-actions>
        <v-btn
          text
          large
          @click="cancelApply"
        >
          {{ $t("cancel") }}
        </v-btn>
        <v-spacer />
        <v-btn
          text
          large
          @click="applySetting()"
        >
          {{ $t("setting.apply") }}
        </v-btn>
      </v-card-actions>
    </v-card>
    <v-card v-else-if="migrateState === 1">
      <v-card-title>
        <h2>{{ $t("setting.waitReload") }}</h2>
      </v-card-title>
      <v-spacer />
      <div style="display: flex; width: 100; justify-content: center">
        <v-progress-circular
          :size="100"
          color="white"
          indeterminate
        />
      </div>
    </v-card>
    <v-card v-else>
      <v-card-title>
        <h2 v-if="error">
          {{ $t("setting.migrateFailed") }}
        </h2>
        <h2 v-else-if="!cleaning">
          {{ $t("setting.migrateSuccess") }}
        </h2>
        <h2 v-else>
          {{ $t("setting.postMigrating") }}
        </h2>
      </v-card-title>
      <v-spacer />
      <v-card-text v-if="error">
        {{ error }}
      </v-card-text>
      <v-divider />
      <v-card-actions v-if="!error">
        <v-checkbox
          v-model="clearData"
          style="margin-left: 10px"
          persistent-hint
          :hint="$t('setting.cleanOldDataHint')"
          :label="$t('setting.cleanOldData')"
        />
      </v-card-actions>
      <v-card-actions>
        <v-spacer />
        <v-btn
          text
          color="primary"
          :loading="cleaning"
          :disabled="cleaning"
          @click="postMigrate"
        >
          {{ $t("setting.migrateDone") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
<script lang="ts" setup>
import { BaseServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { useRefreshable, useService } from '/@/composables'

const { migrate, postMigrate: _postMigrate, openDirectory, state } = useService(BaseServiceKey)
const data = reactive({
  migrateError: undefined as undefined | Error,
})

const { isShown, hide, parameter } = useDialog('migration')
const clearData = ref(false)
const migrateState = ref(0)
const error = ref(undefined as undefined | Error)
const root = computed(() => parameter.value as string)

function cancelApply() {
  hide()
}
async function applySetting() {
  migrateState.value = 1
  try {
    await migrate({ destination: root.value })
  } catch (e) {
    error.value = e as any
  } finally {
    migrateState.value = 2
  }
}

const { refresh: postMigrate, refreshing: cleaning } = useRefreshable(async () => {
  if (clearData) {
    try {
      await _postMigrate()
    } catch (e) {
      // don't stop
      console.error(e)
    }
  }
  hide()
})

</script>
