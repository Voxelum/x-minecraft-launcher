<template>
  <v-dialog v-model="isShown" :width="500" :persistent="true">
    <div class="bg-[#1e1e1e] rounded-xl overflow-hidden border border-[#333]">
      <!-- Header -->
      <div class="bg-[#2d2d2d] px-5 py-4 border-b border-[#333]">
        <div class="flex items-center gap-3">
          <v-icon size="24" color="primary"> dns </v-icon>
          <h3 class="text-lg font-semibold text-white">
            {{ t("server.joinServer") }}
          </h3>
        </div>
      </div>

      <!-- Content -->
      <div class="px-5 py-4">
        <!-- Server info card -->
        <div
          v-if="serverHost"
          class="mb-4 p-3 bg-[#252525] rounded-lg border border-[#333]"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="status.favicon"
              :src="status.favicon"
              class="w-10 h-10 rounded"
            />
            <v-icon v-else icon="dns" size="24" color="primary" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-white truncate">
                {{ serverName || serverHost }}
              </div>
              <div class="text-xs text-gray-400">
                {{ serverHost }}:{{ serverPort || 25565 }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm text-gray-300">
                {{ status.players.online }}/{{ status.players.max }}
              </div>
              <div class="text-xs text-gray-500">{{ status.ping }}ms</div>
            </div>
          </div>
          <!-- MOTD -->
          <div
            v-if="status.description"
            class="mt-2 pt-2 border-t border-[#333]"
          >
            <text-component
              :source="
                typeof status.description === 'string'
                  ? { text: status.description }
                  : status.description
              "
              class="text-xs"
            />
          </div>
        </div>

        <!-- Server host and port inputs -->
        <div class="flex gap-3 mb-3">
          <v-text-field
            v-model="serverHost"
            :label="t('server.address')"
            :hint="t('server.addressHint')"
            persistent-hint
            outlined
            dense
            class="flex-1"
            @keydown.enter="refresh"
          />
          <v-text-field
            v-model.number="serverPort"
            :label="t('server.port')"
            type="number"
            :min="1"
            :max="65535"
            outlined
            dense
            style="max-width: 100px"
            @keydown.enter="refresh"
          />
        </div>

        <!-- Server name input -->
        <v-text-field
          v-model="serverName"
          :label="t('server.serverName')"
          :hint="t('server.nameHint')"
          persistent-hint
          outlined
          dense
        />
      </div>

      <!-- Actions -->
      <div class="px-5 py-3 bg-[#252525] border-t border-[#333]">
        <div class="flex items-center justify-between">
          <v-btn
            variant="text"
            size="small"
            class="text-gray-400 hover:text-white"
            :loading="pinging"
            @click="refresh"
          >
            <v-icon left size="18">refresh</v-icon>
            {{ t("shared.refresh") }}
          </v-btn>
          <div class="flex items-center gap-2">
            <v-btn
              v-if="instance?.server?.host"
              variant="text"
              size="small"
              class="text-red-400 hover:text-red-300"
              @click="onClear"
            >
              <v-icon left size="18">delete</v-icon>
              {{ t("shared.remove") }}
            </v-btn>
            <v-btn
              variant="text"
              size="small"
              class="text-gray-400 hover:text-white"
              @click="onCancel"
            >
              {{ t("shared.cancel") }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              size="small"
              class="text-white font-medium"
              :disabled="!serverHost"
              @click="onSave"
            >
              {{ t("shared.save") }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from "../composables/dialog";
import { useServerStatus } from "../composables/serverStatus";
import { useService } from "../composables/service";
import { InstanceServiceKey } from "@xmcl/runtime-api";
import { ref, computed, watch } from "vue";

const { t } = useI18n();
const { editInstance } = useService(InstanceServiceKey);

const { isShown, hide, parameter } = useDialog("join-server");

const instance = computed(() => parameter.value?.instance);
const serverHost = ref("");
const serverPort = ref<number | undefined>(undefined);
const serverName = ref("");

const server = computed(() => ({
  host: serverHost.value || "",
  port: serverPort.value,
}));

const { status, pinging, refresh } = useServerStatus(server, ref(undefined));

// Initialize fields when dialog opens
watch(isShown, (shown) => {
  if (shown && instance.value?.server) {
    const s = instance.value.server;
    serverHost.value = s.host;
    serverPort.value = s.port;
    serverName.value = parameter.value?.serverName || "";
  } else if (shown) {
    serverHost.value = "";
    serverPort.value = undefined;
    serverName.value = "";
  }
});

const onSave = async () => {
  if (!instance.value || !serverHost.value) return;

  await editInstance({
    instancePath: instance.value.path,
    server: {
      host: serverHost.value,
      port: serverPort.value,
    },
  });

  hide();
  parameter.value?.onSave?.();
};

const onCancel = () => {
  hide();
};

const onClear = async () => {
  if (!instance.value) return;

  await editInstance({
    instancePath: instance.value.path,
    server: null,
  });

  hide();
  parameter.value?.onSave?.();
};
</script>
