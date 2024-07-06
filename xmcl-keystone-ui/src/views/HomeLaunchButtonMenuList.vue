<template>
  <v-list dense>
    <v-list-item @click>
      <v-list-item-title>
        Check integrety
      </v-list-item-title>
    </v-list-item>
    <v-list-item @click="onStartLocalhost">
      <v-list-item-avatar size="20">
        <v-icon size="20">
          dns
        </v-icon>
      </v-list-item-avatar>
      <v-list-item-title>
        {{ t('instance.launchServer') }}
      </v-list-item-title>
    </v-list-item>
  </v-list>
</template>
<script lang="ts" setup>
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { useService } from '@/composables/service'
import { injection } from '@/util/inject'
import { InstanceOptionsServiceKey } from '@xmcl/runtime-api'

const { t } = useI18n()
defineProps<{ }>()

const { installServer } = injection(kInstanceVersionInstall)
const { runtime, path } = injection(kInstance)
const { resolvedVersion } = injection(kInstanceVersion)

const onInstallServer = async () => {
  const version = resolvedVersion.value
  const runtimeValue = (!!version && ('requirements' in version)) ? version.requirements : runtime.value
  const resolveValue = (!!version && !('requirements' in version)) ? version : undefined
  await installServer(runtimeValue, path.value, resolveValue)
}

const {
  show,
} = useDialog('launch-server')
const { launch } = injection(kInstanceLaunch)
const { getEULA, setEULA } = useService(InstanceOptionsServiceKey)
const onStartLocalhost = async () => {
  show()
}
// const onLaunchServer = async () => {
//   const isAccept = await getEULA(path.value)
//   if (!isAccept) {
//     show(true)
//   } else {
//     launch('server')
//   }
// }
const isReady = ref(false)

</script>./AppLaunchServerDialog.vue
