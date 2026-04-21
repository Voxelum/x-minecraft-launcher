<template>
  <v-dialog
    v-model="isShown"
    :width="500"
    :persistent="true"
    transition="fade-transition"
  >
    <div
      class="overflow-hidden flex flex-col w-full bg-white/80 dark:bg-[#121212]/80 backdrop-blur-3xl rounded-[24px] border border-white/40 dark:border-white/10 shadow-2xl transition-all duration-300"
    >
      <!-- Header with Icon -->
      <div class="px-6 pt-8 pb-4 flex flex-col items-center text-center">
        <div
          class="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4"
        >
          <v-icon size="32" color="orange">warning</v-icon>
        </div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {{ t("unauthenticatedWarning.title") }}
        </h3>
        <p
          class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-[80%]"
        >
          {{ t("unauthenticatedWarning.description") }}
        </p>
      </div>

      <!-- Footer Actions -->
      <div
        class="px-6 py-6 mt-2 bg-black/5 dark:bg-white/5 border-t border-black/5 dark:border-white/5"
      >
        <div class="flex items-center justify-between gap-4">
          <!-- Social Icons -->
          <div class="flex items-center gap-1">
            <!-- Discord -->
            <v-btn
              icon
              class="bg-transparent hover:bg-black/5 dark:hover:bg-white/10 text-[#5865F2] transition-colors shadow-none"
              size="small"
              @click="onDiscord"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
                />
              </svg>
            </v-btn>
            <!-- GitHub -->
            <v-btn
              icon
              class="bg-transparent hover:bg-black/5 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 transition-colors shadow-none"
              size="small"
              @click="onGithub"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                />
              </svg>
            </v-btn>
          </div>

          <!-- Buttons -->
          <div class="flex items-center gap-3">
            <button
              class="px-5 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition-all active:scale-95"
              @click="onCancel"
            >
              {{ t("unauthenticatedWarning.cancel") }}
            </button>
            <button
              class="px-6 py-2.5 text-sm font-bold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/30 active:scale-95"
              @click="onPlay"
            >
              {{ t("unauthenticatedWarning.playAnyway") }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import { useDialog } from "../composables/dialog";

const { t } = useI18n();

const { isShown, hide, parameter } = useDialog("unauthenticated-warning");

const onPlay = () => {
  parameter.value?.onPlay?.();
  hide();
};

const onCancel = () => {
  parameter.value?.onCancel?.();
  hide();
};

const onDiscord = () => {
  window.open("https://discord.gg/W5XVwYY7GQ", "browser");
};

const onGithub = () => {
  window.open(
    "https://github.com/Voxelum/x-minecraft-launcher/issues",
    "browser"
  );
};
</script>

<style scoped>
:deep(.v-dialog) {
  box-shadow: none !important;
  border-radius: 24px;
}
</style>
