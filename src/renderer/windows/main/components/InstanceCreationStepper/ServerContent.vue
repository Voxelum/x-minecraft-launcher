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
          style="display: flex; flex-direction: row"
        >
          <img
            :src="status.favicon"
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
              v-if="status.version.name"
              :source="status.version.name"
            />
          </v-layout>
        </v-flex>
        <v-flex
          d-flex
          xs4
          style="display: flex; align-items: center"
        >
          <v-text-field
            :value="$t(status.version.name)"
            dark
            append-icon="title"
            :label="$t('profile.server.version')"
            :readonly="true"
            :loading="pinging"
          />
        </v-flex>
        <v-flex style="display: flex; align-items: center">
          <v-text-field
            :value="status.players.online + '/' + status.players.max"
            dark
            append-icon="people"
            :label="$t('profile.server.players')"
            :readonly="true"
            :loading="pinging"
          />
        </v-flex>
        <v-flex style="display: flex; align-items: center">
          <v-text-field
            :value="status.ping"
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
</template>

<script lang=ts>
import { computed, defineComponent, inject, ref, watch } from '@vue/composition-api'
import { CreateOptionKey } from './creation'
import { required } from '/@/util/props'
import { ServerStatus } from '/@shared/entities/serverStatus'

export default defineComponent({
  props: {
    status: required<ServerStatus>(Object),
    acceptingVersion: required(String),
    pinging: required(Boolean),
    valid: required(Boolean),
  },
  emits: ['update:valid'],
  setup() {
    const content = inject(CreateOptionKey)
    if (!content) { throw new Error('') }
    const server = computed(() => content.server.value ?? { host: '', port: undefined })
    const serverField = ref('')
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
    }
  },
})
</script>
