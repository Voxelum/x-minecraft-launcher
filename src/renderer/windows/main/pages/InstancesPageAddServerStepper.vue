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
        <v-form
          ref="form"
          v-model="valid"
          lazy-validation
          style="height: 100%;"
        >
          <v-container
            grid-list
            fill-height
          >
            <v-layout
              row
              wrap
            >
              <v-flex
                xs12
                style="display: flex; flex-direction: row"
              >
                <img
                  :src="favicon"
                  style="max-width: 80px; max-height: 80px; min-height: 80px;"
                >
                <div style="flex-grow: 1" />
                <v-layout>
                  <span style="display: flex; align-items: center;">
                    <text-component
                      v-if="description"
                      :source="description"
                    />
                    <div
                      v-else
                      style="font-size: 18px; font-weight: bold;"
                    >{{ $t('profile.server.creationHint') }}</div>
                  </span>
                  <text-component
                    v-if="version.name"
                    :source="version.name"
                  />
                </v-layout>
              </v-flex>
              <v-flex
                d-flex
                xs4
                style="display: flex; align-items: center"
              >
                <v-text-field
                  :value="$t(version.name)"
                  dark
                  append-icon="title"
                  :label="$t('profile.server.version')"
                  :readonly="true"
                  :loading="pinging"
                />
              </v-flex>
              <v-flex style="display: flex; align-items: center">
                <v-text-field
                  :value="players.online + '/' + players.max"
                  dark
                  append-icon="people"
                  :label="$t('profile.server.players')"
                  :readonly="true"
                  :loading="pinging"
                />
              </v-flex>
              <v-flex style="display: flex; align-items: center">
                <v-text-field
                  :value="ping"
                  dark
                  append-icon="signal_cellular_alt"
                  :label="$t('profile.server.pings')"
                  :readonly="true"
                  :loading="pinging"
                />
              </v-flex>

              <v-flex
                d-flex
                xs12
              >
                <v-divider />
              </v-flex>

              <v-flex
                d-flex
                xs4
              >
                <v-text-field
                  v-model="serverField"
                  dark
                  persistent-hint
                  :hint="$t('profile.server.hostHint')"
                  :label="$t('profile.server.host')"
                  required
                />
              </v-flex>
              <v-flex
                d-flex
                xs4
              >
                <minecraft-version-menu
                  :accept-range="acceptingVersion"
                  @input="runtime.minecraft = $event"
                >
                  <template #default="{ on }">
                    <v-text-field
                      v-model="runtime.minecraft"
                      dark
                      append-icon="arrow"
                      persistent-hint
                      :hint="$t('profile.server.versionHint')"
                      :label="$t('minecraft.version')"
                      :readonly="true"
                      @click:append="on.keydown"
                      v-on="on"
                    />
                  </template>
                </minecraft-version-menu>
              </v-flex>
              <v-flex
                d-flex
                xs4
              >
                <v-text-field
                  v-model="name"
                  :placeholder="server.host"
                  dark
                  persistent-hint
                  :hint="$t('profile.name')"
                  :label="$t('profile.name')"
                  required
                />
              </v-flex>
            </v-layout>
          </v-container>
        </v-form>
        <v-layout>
          <v-btn
            :disabled="creating"
            flat
            @click="quit"
          >
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <!-- <v-switch v-model="filterVersion" :label="$t('profile.server.filterVersion')" /> -->
          <v-btn
            flat
            @click="step = 2"
          >
            {{ $t('next') }}
          </v-btn>
          <v-btn
            flat
            :loading="pinging"
            :disabled="!server.host || !server.port"
            @click="refresh"
          >
            {{ $t('profile.server.ping') }}
          </v-btn>
          <v-btn
            :loading="creating"
            color="primary"
            :disabled="!valid || runtime.minecraft === ''"
            @click="doCreate"
          >
            {{ $t('create') }}
          </v-btn>
        </v-layout>
      </v-stepper-content>
      <v-stepper-content step="2">
        <v-form
          v-model="valid"
          lazy-validation
          style="height: 100%;"
        >
          <v-container
            grid-list
            fill-height
            style="overflow: auto;"
          >
            <v-layout
              row
              wrap
            >
              <v-flex
                d-flex
                xs6
              >
                <v-select
                  v-model="java"
                  class="java-select"
                  hide-details
                  :item-text="java => `JRE${java.majorVersion}, ${java}`"
                  :item-value="v => v"
                  prepend-inner-icon="add"
                  :label="$t('java.location')"
                  :items="javas"
                  required
                  :menu-props="{ auto: true, overflowY: true }"
                />
              </v-flex>
              <v-flex
                d-flex
                xs3
              >
                <v-text-field
                  v-model="minMemory"
                  hide-details
                  type="number"
                  :label="$t('java.minMemory')"
                  required
                />
              </v-flex>
              <v-flex
                d-flex
                xs3
              >
                <v-text-field
                  v-model="maxMemory"
                  hide-details
                  type="number"
                  :label="$t('java.maxMemory')"
                  required
                />
              </v-flex>
              <v-flex
                d-flex
                xs6
              >
                <forge-version-menu
                  :minecraft="runtime.minecraft"
                  @input="runtime.forge = $event"
                >
                  <template #default="{ on }">
                    <v-text-field
                      v-model="runtime.forge"
                      dark
                      append-icon="arrow"
                      persistent-hint
                      :hint="$t('profile.versionHint')"
                      :label="$t('forge.version')"
                      :readonly="true"
                      @click:append="on.keydown"
                      v-on="on"
                    />
                  </template>
                </forge-version-menu>
              </v-flex>
            </v-layout>
          </v-container>
        </v-form>

        <v-layout>
          <v-btn
            :disabled="creating"
            flat
            @click="quit"
          >
            {{ $t('cancel') }}
          </v-btn>
          <v-spacer />
          <v-btn
            :loading="creating"
            color="primary"
            :disabled="!valid || runtime.minecraft === ''"
            @click="doCreate"
          >
            {{ $t('create') }}
          </v-btn>
        </v-layout>
      </v-stepper-content>
    </v-stepper-items>
  </v-stepper>
</template>

<script lang=ts>
import { reactive, toRefs, ref, Ref, computed, onMounted, watch, defineComponent } from '@vue/composition-api'
import { useJava, useI18n, useServer, useRouter, useInstanceCreation } from '/@/hooks'

export default defineComponent({
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  setup(props, context) {
    const { create, reset: $reset, ...creationData } = useInstanceCreation()
    const { all: javas } = useJava()
    const { $t } = useI18n()
    const router = useRouter()

    const server: Ref<{ host: string; port?: number }> = ref({
      host: '',
      port: 25565,
    })
    const staticData = {
      memoryRule: [(v: number) => Number.isInteger(v)],
      nameRules: [
        (v: string) => !!v || $t('profile.requireName'),
      ],
    }
    const data = reactive({
      step: 1,
      valid: false,
      creating: false,

      filterVersion: false,
      javaValid: true,
    })
    const serverField = ref('')
    const ready = computed(() => data.valid && data.javaValid)
    const dataRef = toRefs(data)

    const {
      favicon,
      acceptingVersion,
      refresh,
      version,
      players,
      ping,
      pinging,
      description,
      reset: resetServer,
    } = useServer(server, ref(undefined))

    function reset() {
      $reset()
      resetServer()
      server.value.host = ''
      server.value.port = 25565
      creationData.name.value = ''
    }

    function init() {
      data.step = 1
      reset()
    }
    function quit() {
      context.emit('quit')
    }
    async function doCreate() {
      try {
        data.creating = true
        creationData.name.value = creationData.name.value || server.value.host
        creationData.server.value = server.value
        await create()
        init()
        router.replace('/')
      } finally {
        data.creating = false
      }
    }
    onMounted(() => {
      watch(() => props.show, () => {
        if (props.show) {
          init()
        }
      })
    })
    watch(serverField, (v) => {
      const [host, port] = v.split(':')
      server.value.host = host
      if (port) {
        server.value.port = Number.parseInt(port, 10)
      } else {
        server.value.port = 25565
      }
    })

    return {
      ...dataRef,
      ...creationData,
      ...staticData,
      serverField,
      favicon,
      acceptingVersion,
      refresh,
      version,
      players,
      ping,
      ready,
      javas,
      doCreate,
      quit,
      pinging,
      server,
      description,
    }
  },
})
</script>

<style>
.java-select .v-select__selection {
  white-space: nowrap;
  overflow-x: hidden;
  overflow-y: hidden;

  max-width: 240px;
}
.v-stepper__step span {
  margin-right: 12px !important;
}
.v-stepper__step div {
  display: flex !important;
}
</style>
