<template>
  <v-form
    lazy-validation
    style="height: 100%;"
    :value="valid"
    @input="emit('update:valid', $event)"
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
            class="mb-6 flex flex-col gap-4 p-2 hover:bg-[rgba(0,0,0,0.2)]"
          >
            <div class="flex w-full items-center gap-5">
              <img
                v-fallback-img="unknownServer"
                :src="status.favicon || unknownServer"
                class="rounded-lg p-1"
                style="max-width: 80px; max-height: 80px; min-height: 80px;"
              >
              <span class="flex flex-grow justify-center">
                <text-component
                  v-if="status.description"
                  :source="status.description"
                />
                <div
                  v-else
                  style="font-size: 18px; font-weight: bold;"
                >{{ t('server.creationHint') }}</div>
              </span>
              <text-component
                v-if="status.version.name"
                :source="status.version.name"
              />
            </div>
            <div class="mb-2 flex gap-4">
              <v-flex d-flex>
                <v-combobox
                  outlined
                  hide-details
                  :value="acceptingMinecrafts"
                  append-icon="title"
                  :label="t('server.version')"
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
                  :label="t('server.players')"
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
                  :label="t('server.ping')"
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
              :hint="t('server.hostHint')"
              :label="t('server.host')"
              required
            />
            <version-menu
              :items="items"
              :refreshing="refreshing"
              @select="content.runtime.minecraft = $event"
            >
              <template #default="{ on }">
                <v-text-field
                  v-model="content.runtime.minecraft"
                  outlined
                  append-icon="arrow"
                  persistent-hint
                  :hint="t('server.versionHint')"
                  :label="t('minecraftVersion.name')"
                  :readonly="true"
                  @click:append="on.keydown($event);"
                  v-on="on"
                />
              </template>
            </version-menu>
            <!-- <minecraft-version-menu
              :accept-range="acceptingVersion"
              @input="runtime.minecraft = $event"
            /> -->
            <v-text-field
              v-model="content.name"
              outlined
              :placeholder="server.host"
              persistent-hint
              :hint="t('instance.name')"
              :label="t('instance.name')"
              required
            />
          </div>
        </v-list-item>
      </v-list>
    </div>
  </v-form>
</template>

<script lang=ts setup>
import { protocolToMinecraft, ServerStatus } from '@xmcl/runtime-api'
import { kInstanceCreation } from '../composables/instanceCreation'
import { useMinecraftVersionList } from '../composables/versionList'
import { vFallbackImg } from '../directives/fallbackImage'
import VersionMenu from './VersionMenu.vue'
import unknownServer from '@/assets/unknown_server.png'

import { injection } from '@/util/inject'
import { kLocalVersions } from '@/composables/versionLocal'

const props = defineProps<{
  status: ServerStatus
  acceptingVersion: string
  pinging: boolean
  valid: boolean
}>()

const emit = defineEmits(['update:valid'])
const { t } = useI18n()
const { versions } = injection(kLocalVersions)
const { items, refreshing } = useMinecraftVersionList(computed(() => content.runtime.minecraft), versions)
const content = injection(kInstanceCreation)
const server = computed(() => content.server ?? { host: '', port: undefined })
const serverField = ref('')
const acceptingMinecrafts = computed(() => protocolToMinecraft[props.status.version.protocol])
watch(serverField, (v) => {
  const [host, port] = v.split(':')
  content.server = {
    host,
    port: port ? Number.parseInt(port, 10) : 25565,
  }
})
</script>
