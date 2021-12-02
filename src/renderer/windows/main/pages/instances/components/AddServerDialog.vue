<template>
  <v-dialog width="900" v-model="isShown" persistent>
    <v-stepper v-model="step" non-linear dark>
      <v-stepper-header>
        <v-stepper-step
          :rules="[() => valid]"
          editable
          :complete="step > 1"
          step="1"
        >{{ $t('profile.baseSetting') }}</v-stepper-step>
        <v-divider />
        <!-- <v-stepper-step editable :complete="step > 2" step="2">
          {{ $t('profile.advancedSetting') }}
          <small>{{ $t('optional') }}</small>
        </v-stepper-step>-->
        <v-divider />
      </v-stepper-header>

      <v-stepper-items>
        <v-stepper-content step="1" style="overflow: auto; max-height: 550px;">
          <server-content
            :status="status"
            :pinging="pinging"
            :accepting-version="acceptingVersion"
            :valid.sync="valid"
          />
          <advance-content :show-minecraft="false" :valid.sync="valid" />
          <stepper-footer
            :disabled="!valid || runtime.minecraft === ''"
            :creating="creating"
            create
            @create="onCreate"
            @quit="quit"
          >
            <v-btn
              flat
              :loading="pinging"
              :disabled="!server.host || !server.port"
              @click="refresh"
            >{{ $t('profile.server.ping') }}</v-btn>
          </stepper-footer>
        </v-stepper-content>
      </v-stepper-items>
    </v-stepper>
  </v-dialog>
</template>

<script lang=ts>
import { computed, defineComponent, provide, reactive, toRefs, watch } from '@vue/composition-api'
import { useDialog } from '../../../composables'
import { CreateOptionKey } from './InstanceCreationStepper/creation'
import AdvanceContent from './StepperAdvanceContent.vue'
import StepperFooter from './StepperFooter.vue'
import ServerContent from './StepperServerContent.vue'
import { useInstanceCreation, useServer } from '/@/hooks'
import { withDefault } from '/@/util/props'
import protocolToMinecraft from '/@shared/util/protocolToMinecraft'

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
    const { create, reset: _reset, ...creationData } = useInstanceCreation()
    const { isShown } = useDialog('add-server-dialog')
    provide(CreateOptionKey, creationData)

    const minecraftToProtocol: Record<string, number> = {}
    for (const [key, val] of (Object.entries(protocolToMinecraft))) {
      for (const p of val) {
        minecraftToProtocol[p] = Number(key)
      }
    }

    const protocol = computed(() => minecraftToProtocol[creationData.runtime.value.minecraft] ?? 498)
    const data = reactive({
      step: 1,
      valid: false,
      creating: false,
      filterVersion: false,
    })
    const server = computed(() => creationData.server.value ?? { host: '', port: undefined })
    const {
      status,
      acceptingVersion,
      refresh,
      pinging,
      reset: resetServer,
    } = useServer(server, protocol)
    const ready = computed(() => data.valid)

    function reset() {
      _reset()
      creationData.server.value = null
      resetServer()
      creationData.name.value = ''
      data.step = 1
    }

    function quit() {
      isShown.value = false
    }
    async function onCreate() {
      try {
        data.creating = true
        creationData.name.value = creationData.name.value || server.value.host
        creationData.server.value = server.value
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
