<template>
  <div
    style="overflow: auto; max-height: 70vh; padding: 24px 24px 16px"
  >
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
          color="transparent"
          class="w-full pb-0"
        >
          <v-list-item>
            <v-card
              outlined
              class="mb-6 flex flex-col gap-4 p-2 hover:bg-[rgba(0,0,0,0.2)]"
            >
              <div class="flex w-full items-center gap-5">
                <img
                  v-fallback-img="BuiltinImages.unknownServer"
                  :src="status.favicon || BuiltinImages.unknownServer"
                  class="rounded-lg p-1"
                  style="max-width: 80px; max-height: 80px; min-height: 80px;"
                >
                <span class="flex flex-grow justify-center">
                  <text-component
                    v-if="status.description"
                    :source="typeof status.description === 'string' ? t(status.description) : status.description"
                  />
                  <div
                    v-else
                    style="font-size: 18px; font-weight: bold;"
                  >{{ t('server.creationHint') }}</div>
                </span>
                <text-component
                  v-if="status.version.name"
                  class="mr-2"
                  :source="typeof status.version.name === 'string' ? t(status.version.name) : status.version.name"
                />
              </div>
              <div class="mb-2 grid grid-cols-12 gap-4">
                <v-combobox
                  class="col-span-6"
                  outlined
                  hide-details
                  :value="acceptingMinecrafts"
                  append-icon="title"
                  :label="t('server.version')"
                  :readonly="true"
                  :loading="pinging"
                />
                <v-text-field
                  class="col-span-4"
                  outlined
                  hide-details
                  :value="status.players.online + '/' + status.players.max"
                  append-icon="people"
                  :label="t('server.players')"
                  :readonly="true"
                  :loading="pinging"
                />
                <v-text-field
                  class="col-span-2"
                  :value="status.ping"
                  outlined
                  hide-details
                  append-icon="signal_cellular_alt"
                  :label="t('server.ping')"
                  :readonly="true"
                  :loading="pinging"
                />
              </div>
            </v-card>
          </v-list-item>

          <v-list-item>
            <div class="grid w-full grid-cols-3 gap-4">
              <v-text-field
                v-model="serverField"
                :rules="[!serverField ? 'Required' : undefined]"
                outlined
                persistent-hint
                autofocus
                :hint="t('server.hostHint')"
                :label="t('server.host')"
                @keydown.enter="refresh"
              />
              <div />
              <div class="flex justify-end">
                <v-btn
                  text
                  x-large
                  color="primary"
                  :disabled="!server.host"
                  :loading="pinging"
                  outlined
                  @click="refresh"
                >
                  <v-icon left>
                    wifi
                  </v-icon>
                  {{ t('refresh') }}
                </v-btn>
              </div>
            </div>
          </v-list-item>
        </v-list>
      </div>
    </v-form>
  </div>
</template>

<script lang=ts setup>
import { useServerStatus } from '@/composables/serverStatus'
import { injection } from '@/util/inject'
import { protocolToMinecraft } from '@xmcl/runtime-api'
import { kInstanceCreation } from '../composables/instanceCreation'
import { vFallbackImg } from '../directives/fallbackImage'
import { BuiltinImages } from '@/constant'

const props = defineProps<{
  valid: boolean
}>()

const minecraftToProtocol: Record<string, number> = {}
for (const [key, val] of (Object.entries(protocolToMinecraft))) {
  for (const p of val) {
    minecraftToProtocol[p] = Number(key)
  }
}
const emit = defineEmits(['update:valid'])
const { t } = useI18n()
const { data: creationData } = injection(kInstanceCreation)

const protocol = computed(() => minecraftToProtocol[creationData.runtime.minecraft] ?? 498)
const server = computed(() => creationData.server ?? { host: '', port: undefined })
const { status, pinging, refresh } = useServerStatus(server, protocol)

const serverField = ref('')
const acceptingMinecrafts = computed(() => protocolToMinecraft[status.value.version.protocol])
watch(serverField, (v) => {
  const [host, port] = v.split(':')
  creationData.server = {
    host,
    port: port ? Number.parseInt(port, 10) : 25565,
  }
})
</script>
