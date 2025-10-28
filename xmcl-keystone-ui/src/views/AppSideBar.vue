<template>
  <v-navigation-drawer
    :value="true"
    permanent
    :mini-variant="true"
    :color="sideBarColor"
    class="sidebar moveable z-10 rounded-[0.75rem]"
    :style="{ 'backdrop-filter': `blur(${blurSidebar}px)` }"
  >
    <!-- Top Navigation -->
    <v-list nav dense class="px-2 py-1">
      <v-list-item class="non-moveable mb-1" @click="goBack">
        <v-icon class="text-[18px]">arrow_back</v-icon>
      </v-list-item>

      <v-list-item
        id="my-stuff-button"
        v-shared-tooltip.right="(_) => t('myStuff')"
        link
        to="/me"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-icon>widgets</v-icon>
        </v-list-item-icon>
        <v-list-item-title v-text="t('myStuff')" />
      </v-list-item>

      <v-list-item
        v-shared-tooltip.right="(_) => t('store.name', 2)"
        link
        to="/store"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-icon :size="28">store</v-icon>
        </v-list-item-icon>
        <v-list-item-title v-text="t('store.name', 2)" />
      </v-list-item>

      <v-divider class="my-2" />
    </v-list>

    <!-- Dynamic Content -->
    <AppSideBarContentNext />

    <!-- Bottom Navigation -->
    <v-list nav dense class="px-2 py-1 mt-auto">
      <v-divider class="my-2" />

      <v-list-item
        v-shared-tooltip.right="(_) => t('multiplayer.name')"
        link
        class="non-moveable"
        @click="goMultiplayer"
      >
        <v-list-item-icon>
          <v-icon :size="23">hub</v-icon>
        </v-list-item-icon>
        <v-list-item-title>{{ t("multiplayer.name") }}</v-list-item-title>
      </v-list-item>

      <v-list-item
        v-shared-tooltip.right="(_) => t('setting.name', 2)"
        link
        to="/setting"
        class="non-moveable"
      >
        <v-list-item-icon>
          <v-badge right overlap :value="state?.updateStatus !== 'none'">
            <template #badge>
              <span>1</span>
            </template>
            <v-icon>settings</v-icon>
          </v-badge>
        </v-list-item-icon>
        <v-list-item-title>{{ t("setting.name", 2) }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script lang="ts" setup>
import { kSettingsState } from "@/composables/setting";
import { kTheme } from "@/composables/theme";
import { injection } from "@/util/inject";
import { vSharedTooltip } from "@/directives/sharedTooltip";
import AppSideBarContentNext from "./AppSideBarContentNext.vue";

const { t } = useI18n();
const { back } = useRouter();
const { blurSidebar, sideBarColor } = injection(kTheme);
const { state } = injection(kSettingsState);

const goBack = () => back();
const goMultiplayer = () => windowController.openMultiplayerWindow();
</script>

<style scoped>
.sidebar {
  min-width: 80px;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease-in-out;
}

.sidebar :deep(.v-list) {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.sidebar :deep(.v-list-item) {
  min-height: 40px;
  margin-bottom: 0.125rem;
  border-radius: 0.5rem;
  transition: all 0.15s ease;
}

.sidebar :deep(.v-list-item__icon) {
  margin-right: 0;
}
</style>

<style>
.v-navigation-drawer__content {
  @apply flex flex-col h-full;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Active State */
.sidebar .v-list-item--active,
.sidebar .v-list-item--active .v-icon {
  color: var(--color-primary);
}

/* Hover Effects */
.sidebar .v-list-item--link:hover {
  transform: translateX(2px);
}

.sidebar .v-list-item--link::before {
  border-radius: 0.5rem;
  transition: opacity 0.15s ease;
}

/* Dark Theme */
.dark .sidebar .v-list-item .theme--dark.v-icon {
  color: var(--icon-color);
}

.dark .sidebar .v-list-item:hover .theme--dark.v-icon {
  color: var(--icon-color-hovered);
}

.dark .sidebar .theme--dark.v-list-item--active:hover::before {
  opacity: 0.5;
}

/* Light Theme */
.sidebar .theme--light.v-list-item--active::before {
  opacity: 0.25;
  background-color: gray;
}

/* Avatar Group Header */
.avatar
  .v-list-group__header.v-list-item--active:not(:hover):not(:focus)::before {
  opacity: 0.24;
}

/* Scrollbar Styling */
.v-navigation-drawer__content::-webkit-scrollbar {
  width: 4px;
}

.v-navigation-drawer__content::-webkit-scrollbar-track {
  background: transparent;
}

.v-navigation-drawer__content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.dark .v-navigation-drawer__content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}
</style>
