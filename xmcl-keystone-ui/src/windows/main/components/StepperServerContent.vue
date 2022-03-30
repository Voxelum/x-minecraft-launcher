<template>
  <v-form
    lazy-validation
    style="height: 100%;"
    :value="valid"
    @input="$emit('update:valid', $event)"
  >
    <div
      class="flex flex-col gap-4"
    >
      <v-list
        three-line
        subheader
        class="pb-0"
        style="background: transparent; width: 100%"
      >
        <v-list-item>
          <v-card
            outlined
            class="flex flex-col gap-4 hover:bg-[rgba(0,0,0,0.2)] mb-6 p-2"
          >
            <div class="flex items-center gap-5 w-full">
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
            </div>
            <div class="flex gap-4 mb-2">
              <v-flex d-flex>
                <v-combobox
                  outlined
                  hide-details
                  :value="acceptingMinecrafts"
                  append-icon="title"
                  :label="$t('profile.server.version')"
                  :readonly="true"
                  :loading="pinging"
                />
              </v-flex>
              <v-flex
                d-flex
                xs4
              >
                <v-text-field
                  outlined
                  hide-details
                  :value="status.players.online + '/' + status.players.max"
                  append-icon="people"
                  :label="$t('profile.server.players')"
                  :readonly="true"
                  :loading="pinging"
                />
              </v-flex>
              <v-flex
                d-flex
                xs2
              >
                <v-text-field
                  :value="status.ping"
                  outlined
                  hide-details
                  append-icon="signal_cellular_alt"
                  :label="$t('profile.server.pings')"
                  :readonly="true"
                  :loading="pinging"
                />
              </v-flex>
            </div>
          </v-card>
        </v-list-item>

        <v-list-item>
          <div class="flex gap-4">
            <v-text-field
              v-model="serverField"
              outlined
              persistent-hint
              :hint="$t('profile.server.hostHint')"
              :label="$t('profile.server.host')"
              required
            />
            <minecraft-version-menu
              :accept-range="acceptingVersion"
              @input="runtime.minecraft = $event"
            >
              <template #default="{ on }">
                <v-text-field
                  v-model="runtime.minecraft"
                  outlined
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
            <v-text-field
              v-model="name"
              outlined
              :placeholder="server.host"
              persistent-hint
              :hint="$t('profile.name')"
              :label="$t('profile.name')"
              required
            />
          </div>
        </v-list-item>
      </v-list>
    </div>
  </v-form>
</template>

<script lang=ts>
import { computed, defineComponent, inject, ref, watch } from '@vue/composition-api'
import { required } from '/@/util/props'
import { ServerStatus, protocolToMinecraft } from '@xmcl/runtime-api'
import MinecraftVersionMenu from './MinecraftVersionMenu.vue'
import unknownServer from '/@/assets/unknown_server.png'
import { CreateOptionKey } from '../composables/instanceCreation'
import { injection } from '/@/util/inject'

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
    const content = injection(CreateOptionKey)
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
