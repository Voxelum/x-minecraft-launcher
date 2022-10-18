<template>
  <v-dialog
    v-model="isShown"
    width="900"
    persistent
  >
    <v-stepper
      v-model="step"
      non-linear
    >
      <v-stepper-header>
        <v-stepper-step
          :rules="[() => valid]"
          editable
          :complete="step > 1"
          step="1"
        >
          {{ $t('baseSetting.title') }}
        </v-stepper-step>
        <v-divider />
      </v-stepper-header>

      <v-stepper-items
        class="visible-scroll"
      >
        <v-stepper-content
          step="1"
          style="overflow: auto; max-height: 550px;"
        >
          <server-content
            :status="status"
            :pinging="pinging"
            :accepting-version="acceptingVersion"
            :valid.sync="valid"
          />
          <advance-content
            :show-minecraft="false"
            :valid.sync="valid"
          />
          <stepper-footer
            :disabled="!valid || runtime.minecraft === ''"
            :creating="creating"
            create
            @create="onCreate"
            @quit="quit"
          >
            <v-btn
              text
              :loading="pinging"
              :disabled="!server.host || !server.port"
              @click="refresh"
            >
              {{ $t('server.ping') }}
            </v-btn>
          </stepper-footer>
        </v-stepper-content>
      </v-stepper-items>
    </v-stepper>
  </v-dialog>
</template>

<script lang=ts>
import { withDefault } from '/@/util/props'
import { protocolToMinecraft } from '@xmcl/runtime-api'
import AdvanceContent from '../components/StepperAdvanceContent.vue'
import StepperFooter from '../components/StepperFooter.vue'
import ServerContent from '../components/StepperServerContent.vue'
import { useDialog } from '../composables/dialog'
import { useInstanceCreation, CreateOptionKey } from '../composables/instanceCreation'
import { useServerStatus } from '../composables/serverStatus'

export default defineComponent({
  components: {
    StepperFooter,
    AdvanceContent,
    ServerContent,
  },
  props: {
    show: withDefault(Boolean, () => false),
  },
  setup(props) {
    const { create, reset: _reset, data: creationData } = useInstanceCreation()
    const { isShown } = useDialog('add-server-dialog')
    provide(CreateOptionKey, creationData)

    const minecraftToProtocol: Record<string, number> = {}
    for (const [key, val] of (Object.entries(protocolToMinecraft))) {
      for (const p of val) {
        minecraftToProtocol[p] = Number(key)
      }
    }

    const protocol = computed(() => minecraftToProtocol[creationData.runtime.minecraft] ?? 498)
    const data = reactive({
      step: 1,
      valid: false,
      creating: false,
      filterVersion: false,
    })
    const server = computed(() => creationData.server ?? { host: '', port: undefined })
    const {
      status,
      acceptingVersion,
      refresh,
      pinging,
      reset: resetServer,
    } = useServerStatus(server, protocol)
    const ready = computed(() => data.valid)

    function reset() {
      _reset()
      creationData.server = null
      resetServer()
      creationData.name = ''
      data.step = 1
    }

    function quit() {
      isShown.value = false
    }
    async function onCreate() {
      try {
        data.creating = true
        creationData.name = creationData.name || server.value.host
        creationData.server = server.value
        await create()
        reset()
        isShown.value = false
      } finally {
        data.creating = false
      }
    }
    watch(() => props.show, (newVal) => {
      if (newVal) {
        reset()
      }
    })

    return {
      ...toRefs(data),
      ...creationData,
      acceptingVersion,
      refresh,
      status,
      ready,
      onCreate,
      quit,
      pinging,
      server,
      isShown,
    }
  },
})
</script>
