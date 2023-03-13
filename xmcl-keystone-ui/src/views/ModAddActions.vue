<template>
  <div class="flex gap-3 items-center justify-end">
    <!-- <v-btn
      color="primary"
    >
      <v-icon>
        save
      </v-icon>
      Save
    </v-btn> -->
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'

const { showDirectory } = useService(InstanceModsServiceKey)

const { t } = useI18n()
const { push } = useRouter()
const onInstall = () => {
  push('/mod-add')
}
</script>
