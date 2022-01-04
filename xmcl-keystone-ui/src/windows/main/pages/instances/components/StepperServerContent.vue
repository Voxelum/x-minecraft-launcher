<template>
  <v-form
    lazy-validation
    style="height: 100%;"
    :value="valid"
    @input="$emit('update:valid', $event)"
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
          class="gap-5 items-center rounded bg-[rgba(0,0,0,0.1)] hover:bg-[rgba(0,0,0,0.2)] mb-2"
        >
          <img
            v-fallback-img="unknownServer"
            :src="status.favicon || unknownServer"
            class="rounded-lg p-1"
            style="max-width: 80px; max-height: 80px; min-height: 80px;"
          >
          <span class="flex-grow justify-center flex">
            <text-component
              v-if="status.description"
              :source="status.description"
            />
            <div
              v-else
              style="font-size: 18px; font-weight: bold;"
            >{{ $t('profile.server.creationHint') }}</div>
          </span>
          <text-component
            v-if="status.version.name"
            :source="status.version.name"
          />
        </v-flex>
        <v-flex
          d-flex
          xs4
          style="display: flex; align-items: center;"
        >
          <v-combobox
            box
            hide-details
            :value="acceptingMinecrafts"
            append-icon="title"
            :label="$t('profile.server.version')"
            :readonly="true"
            :loading="pinging"
          />
        </v-flex>
        <v-flex style="display: flex; align-items: center">
          <v-text-field
            box
            hide-details
            :value="status.players.online + '/' + status.players.max"
            append-icon="people"
            :label="$t('profile.server.players')"
            :readonly="true"
            :loading="pinging"
          />
        </v-flex>
        <v-flex style="display: flex; align-items: center;">
          <v-text-field
            :value="status.ping"
            hide-details
            box
            append-icon="signal_cellular_alt"
            :label="$t('profile.server.pings')"
            :readonly="true"
            :loading="pinging"
          />
        </v-flex>

        <!-- <v-flex d-flex xs12>
          <v-divider />
        </v-flex> -->

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
</template>

<script lang=ts>
import { computed, defineComponent, inject, ref, watch } from '@vue/composition-api'
import { CreateOptionKey } from '/@/windows/main/components/AddInstanceDialog.vue'
import { required } from '/@/util/props'
import { ServerStatus, protocolToMinecraft } from '@xmcl/runtime-api'
import MinecraftVersionMenu from '../../../components/MinecraftVersionMenu.vue'
import unknownServer from '/@/assets/unknown_server.png'

export default defineComponent({
  components: { MinecraftVersionMenu },
  props: {
    status: required<ServerStatus>(Object),
    acceptingVersion: required(String),
    pinging: required(Boolean),
    valid: required(Boolean),
  },
  emits: ['update:valid'],
  setup(props) {
    const content = inject(CreateOptionKey)
    if (!content) {
      throw new Error('')
    }
    const server = computed(() => content.server.value ?? { host: '', port: undefined })
    const serverField = ref('')
    const acceptingMinecrafts = computed(() => protocolToMinecraft[props.status.version.protocol])
    watch(serverField, (v) => {
      const [host, port] = v.split(':')
      content.server.value = {
        host,
        port: port ? Number.parseInt(port, 10) : 25565,
      }
    })
    return {
      ...content,
      runtime: content.runtime,
      serverField,
      server,
      unknownServer,
      acceptingMinecrafts,
    }
  },
})
</script>
