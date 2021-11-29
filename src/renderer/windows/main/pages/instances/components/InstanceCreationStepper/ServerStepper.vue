<template>
  <v-stepper
    v-model="step"
    non-linear
    dark
  >
    <v-stepper-header>
      <v-stepper-step
        :rules="[() => valid]"
        editable
        :complete="step > 1"
        step="1"
      >
        {{ $t('profile.baseSetting') }}
      </v-stepper-step>
      <v-divider />
      <v-stepper-step
        editable
        :complete="step > 2"
        step="2"
      >
        {{ $t('profile.advancedSetting') }}
        <small>{{ $t('optional') }}</small>
      </v-stepper-step>
      <v-divider />
    </v-stepper-header>

    <v-stepper-items>
      <v-stepper-content step="1">
        <server-content
          :status="status"
          :pinging="pinging"
          :accepting-version="acceptingVersion"
          :valid.sync="valid"
        />
        <stepper-footer
          :disabled="!valid || runtime.minecraft === ''"
          :creating="creating"
          next
          create
          @quit="quit"
          @next="step = 2"
        >
          <v-btn
            flat
            :loading="pinging"
            :disabled="!server.host || !server.port"
            @click="refresh"
          >
            {{ $t('profile.server.ping') }}
          </v-btn>
        </stepper-footer>
      </v-stepper-content>
      <v-stepper-content step="2">
        <advance-content
          :valid.sync="valid"
        />
        <stepper-footer
          :creating="creating"
          :disabled="!valid || runtime.minecraft === ''"
          create
          @create="onCreate"
          @quit="quit"
        />
      </v-stepper-content>
    </v-stepper-items>
  </v-stepper>
</template>

<script lang=ts>
import { reactive, toRefs, ref, computed, onMounted, watch, defineComponent, provide } from '@vue/composition-api'
import { useI18n, useServer, useInstanceCreation } from '/@/hooks'
import { CreateOptionKey } from './creation'
import StepperFooter from './StepperFooter.vue'
import AdvanceContent from './AdvanceContent.vue'
import ServerContent from './ServerContent.vue'
import { withDefault } from '/@/util/props'

export default defineComponent({
  components: {
    StepperFooter,
    AdvanceContent,
    ServerContent,
  },
  props: {
    show: withDefault(Boolean, () => false),
  },
  setup(props, context) {
    const { create, reset: _reset, ...creationData } = useInstanceCreation()
    const { $t } = useI18n()
    provide(CreateOptionKey, creationData)

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
    } = useServer(server, ref(undefined))
    const ready = computed(() => data.valid)

    function reset() {
      _reset()
      creationData.server.value = null
      resetServer()
      creationData.name.value = ''
      data.step = 1
    }

    function quit() {
      context.emit('quit')
    }
    async function onCreate() {
      try {
        data.creating = true
        creationData.name.value = creationData.name.value || server.value.host
        creationData.server.value = server.value
        await create()
        reset()
        context.emit('create')
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
    }
  },
})
</script>
