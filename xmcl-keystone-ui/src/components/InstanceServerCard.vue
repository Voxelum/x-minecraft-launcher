<template>
  <div
    v-if="instance?.server?.host"
    class="server-card mt-2 p-3 bg-[#252525] rounded-lg border border-[#333]"
  >
    <div class="flex items-center gap-3">
      <!-- Server favicon -->
      <img
        v-if="status.favicon"
        :src="status.favicon"
        class="w-10 h-10 rounded"
      />
      <v-icon v-else icon="dns" size="24" color="primary" />

      <!-- Server info -->
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-white truncate">
          {{ serverName || instance.server.host }}
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">
            {{ instance.server.host }}:{{ instance.server.port || 25565 }}
          </span>
          <v-icon
            size="16"
            class="text-gray-500 cursor-pointer hover:text-primary ml-2"
            @click="copyAddress"
          >
            content_copy
          </v-icon>
        </div>
      </div>

      <!-- Players count -->
      <div class="text-right">
        <div class="text-sm text-gray-300">
          <v-icon size="14" color="primary">group</v-icon>
          {{ status.players.online }}/{{ status.players.max }}
        </div>
        <div class="text-xs text-gray-500">{{ status.ping }}ms</div>
      </div>
    </div>

    <!-- MOTD -->
    <div v-if="status.description" class="mt-2 pt-2 border-t border-[#333]">
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
</template>

<script lang="ts" setup>
import { Instance } from "@xmcl/instance";
import TextComponent from "@/components/TextComponent";
import { useServerStatus } from "../composables/serverStatus";
import { computed, ref, onMounted, onUnmounted } from "vue";
import { protocolToMinecraft } from "@xmcl/runtime-api";

const props = defineProps<{
  instance: Instance | undefined;
}>();

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
      console.log("Copied server address:", address);
    })
    .catch((err) => {
      console.error("Failed to copy:", err);
    });
};
</script>
