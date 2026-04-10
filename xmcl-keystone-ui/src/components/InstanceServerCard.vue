<template>
  <div
    v-if="instance?.server?.host"
    class="server-card mt-2 p-2.5 bg-[#252525]/80 rounded-lg border border-[#333]/50 backdrop-blur-sm overflow-hidden"
  >
    <div class="flex items-center gap-2.5">
      <!-- Server favicon -->
      <img
        v-if="status.favicon"
        :src="status.favicon"
        class="w-9 h-9 rounded-lg flex-shrink-0"
      />
      <v-icon
        v-else
        icon="dns"
        size="22"
        color="primary"
        class="flex-shrink-0"
      />

      <!-- Server info -->
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-white truncate">
          {{ serverName || instance.server.host }}
        </div>
        <div class="flex items-center gap-1.5 mt-0.5">
          <span class="text-xs text-gray-400 truncate">
            {{ instance.server.host }}:{{ instance.server.port || 25565 }}
          </span>
          <v-icon
            size="14"
            class="text-gray-500 cursor-pointer hover:text-primary transition-colors flex-shrink-0"
            @click="copyAddress"
          >
            content_copy
          </v-icon>
        </div>
      </div>

      <!-- Players & Ping -->
      <div class="flex flex-col items-end gap-0.5 flex-shrink-0">
        <div class="flex items-center gap-1 text-xs text-gray-300">
          <v-icon size="12" color="primary" class="flex-shrink-0">group</v-icon>
          <span class="font-medium"
            >{{ status.players.online
            }}<span class="text-gray-500">/{{ status.players.max }}</span></span
          >
        </div>
        <div class="text-xs text-gray-500">{{ status.ping }}ms</div>
      </div>
    </div>

    <!-- MOTD -->
    <div v-if="status.description" class="mt-2 pt-2 border-t border-[#333]/50">
      <text-component
        :source="
          typeof status.description === 'string'
            ? { text: status.description }
            : status.description
        "
        class="text-xs leading-relaxed line-clamp-2"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Instance } from "@xmcl/instance";
import TextComponent from "@/components/TextComponent";
import { useServerStatus } from "../composables/serverStatus";
import { useNotifier } from "../composables/notifier";
import { computed, ref, onMounted, onUnmounted } from "vue";
import { protocolToMinecraft } from "@xmcl/runtime-api";

const props = defineProps<{
  instance: Instance | undefined;
}>();

const { notify } = useNotifier();

const minecraftToProtocol: Record<string, number> = {};
for (const [key, val] of Object.entries(protocolToMinecraft)) {
  for (const p of val) {
    minecraftToProtocol[p] = Number(key);
  }
}

const server = computed(() => props.instance?.server ?? { host: "" });
const serverName = ref("");
const protocol = computed(
  () =>
    minecraftToProtocol[props.instance?.runtime.minecraft ?? ""] ?? undefined
);

const { status, refresh } = useServerStatus(server, protocol);

// Auto-refresh server status on mount and every 5 minutes
let refreshInterval: number | undefined;

onMounted(() => {
  if (props.instance?.server?.host) {
    refresh();
    // Refresh every 5 minutes (300000 ms)
    refreshInterval = window.setInterval(() => {
      if (props.instance?.server?.host) {
        refresh();
      }
    }, 5 * 60 * 1000);
  }
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

const copyAddress = () => {
  if (!props.instance?.server?.host) return;
  const address = `${props.instance.server.host}:${
    props.instance.server.port || 25565
  }`;
  navigator.clipboard
    .writeText(address)
    .then(() => {
      notify({
        level: "success",
        title: "Copied!",
        body: `Server address copied: ${address}`,
      });
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
      notify({
        level: "error",
        title: "Copy failed",
        body: "Could not copy server address to clipboard",
      });
    });
};
</script>
