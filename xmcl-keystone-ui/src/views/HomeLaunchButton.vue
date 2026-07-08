<template>
  <div
    v-if="!shouldHideLaunchButton"
    v-roving-tabindex
    role="group"
    aria-orientation="horizontal"
    :aria-label="text"
    class="flex flex-grow-0 items-center"
  >
    
    <div
      class="relative inline-flex launch-pill"
      :class="{ short: !top }"
    >
      <v-btn
        id="launch-button"
        data-testid="launch-button"
        :disabled="isValidating"
        :color="color"
        :size="compact ? 'large' : 'x-large'"
        rounded="pill"
        class="pl-24 pr-24 text-xl transition-all btn-launch"
        :aria-label="text"
        @click="onClick()"
        @mouseenter="onHoverEnter"
        @mouseleave="onHoverLeave"
      >
        <span
          v-if="isGamepadActive"
          class="gp-btn__key gp-btn__key--primary mr-2"
          style="transform: scale(0.85); vertical-align: middle;"
        >{{ buttonX }}</span>
        {{ text }}
        <v-badge
          :model-value="count !== 0"
          inline
          class="pb-1 pl-1"
          color="primary"
          :content="count"
        />
      </v-btn>

      <!-- Left circular play button: launches the game on click -->
      <v-btn
        :disabled="isValidating"
        data-testid="launch-button-play"
        data-roving-skip
        icon
        tabindex="-1"
        rounded="pill"
        inert
        :size="compact ? 'small' : 'default'"
        variant="flat"
        class="btn-play-inset"
        :aria-label="text"
        @click="onPlayClick"
        @mouseenter="onHoverEnter"
        @mouseleave="onHoverLeave"
      >
        <v-progress-circular
          v-if="loading"
          indeterminate
          :size="20"
          :width="2"
        />
        <v-icon
          v-else
          aria-hidden="true"
          class="nested-icon"
          :class="{ spin: isSpinning }"
          @animationend="isSpinning = false"
        >
          {{ leftIcon || icon || 'play_arrow' }}
        </v-icon>
      </v-btn>

      <!-- Right circular settings button: hover opens the unified menu,
            click navigates to the instance setting page -->
      <v-menu
        v-model="isShown"
        :location="top ? 'top end' : 'bottom end'"
        :open-on-focus="false"
        :open-on-hover="true"
        :open-on-click="false"
        transition="scroll-y-transition"
      >
        <template #activator="{ props: activatorProps }">
          <v-btn
            :disabled="isValidating"
            data-testid="launch-button-menu"
            icon
            rounded="pill"
            :size="compact ? 'small' : 'default'"
            variant="flat"
            class="btn-menu-inset"
            :aria-label="t('baseSetting.title', 2)"
            :aria-haspopup="'menu'"
            :aria-expanded="isShown"
            to="/base-setting"
            v-bind="activatorProps"
            @mouseenter="onHoverEnter"
            @mouseleave="onHoverLeave"
          >
            <v-icon
              aria-hidden="true"
              class="nested-icon"
              :class="{ 'is-active': isShown }"
            >
              settings
            </v-icon>
          </v-btn>
        </template>
        <HomeLaunchButtonMenuList />
      </v-menu>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { kLaunchButton } from '@/composables/launchButton'
import { injection } from '@/util/inject'
import HomeLaunchButtonMenuList from './HomeLaunchButtonMenuList.vue'
import { kInstances } from '@/composables/instances'
import { vRovingTabindex } from '@/directives/rovingTabindex'
import { kInstance } from '@/composables/instance'
import { useHasMinecraftLicense } from '@/composables/minecraftLicense'
import { useGamepad } from '@/composables/gamepad'
import { isBedrockInstance } from '@xmcl/instance'

defineProps<{ compact?: boolean; top?: boolean }>()

const emit = defineEmits(['mouseenter', 'mouseleave'])
const { isValidating } = injection(kInstances)

const { onClick, color, icon, text, loading, leftIcon, count } = injection(kLaunchButton)
const { isActive: isGamepadActive, buttonX } = useGamepad()
const { t } = useI18n()

const { instance } = injection(kInstance)
const { hasMinecraftLicense } = useHasMinecraftLicense()
const isBedrock = computed(() => isBedrockInstance(instance.value))
const shouldHideLaunchButton = computed(() => isBedrock.value && !hasMinecraftLicense.value)

const isShown = ref(false)
const isSpinning = ref(false)

function onHoverEnter() {
  emit('mouseenter')
}
function onHoverLeave() {
  emit('mouseleave')
}
function onPlayClick() {
  isSpinning.value = true
  onClick()
}
</script>

<style scoped>
.btn-launch {
  border-radius: 9999px;
  height: 64px;
}

/* Embed the play button inside the pill at its leading edge. */
.btn-play-inset {
  position: absolute;
  inset-inline-start: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 52px;
  height: 52px;
  background-color: rgba(255, 255, 255, 0.22) !important;
  color: #fff !important;
}

.btn-play-inset :deep(.v-icon) {
  font-size: 28px;
}

/* Embed the menu button inside the pill at its trailing edge. */
.btn-menu-inset {
  position: absolute;
  inset-inline-end: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 52px !important;
  height: 52px !important;
  background-color: rgba(0, 0, 0, 0.32) !important;
  color: #fff !important;
}

.btn-menu-inset :deep(.v-icon) {
  font-size: 28px;
}

/* Animate the nested-button icons when their menu is open. */
.nested-icon {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-menu-inset .nested-icon.is-active {
  transform: rotate(90deg);
}

/* Play icon does a single full spin when clicked. */
.btn-play-inset .nested-icon.spin {
  animation: play-spin 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes play-spin {
  from {
    transform: rotate(0deg) scale(1);
  }
  50% {
    transform: rotate(180deg) scale(1.15);
  }
  to {
    transform: rotate(360deg) scale(1);
  }
}

/* Header (extension) placement: a shorter pill than the focus-mode footer. */
.launch-pill.short .btn-launch {
  height: 52px !important;
}

.launch-pill.short .btn-play-inset,
.launch-pill.short .btn-menu-inset {
  width: 40px !important;
  height: 40px !important;
}

.launch-pill.short .btn-play-inset :deep(.v-icon),
.launch-pill.short .btn-menu-inset :deep(.v-icon) {
  font-size: 22px;
}

@media (max-width: 850px) {
  .btn-launch {
    max-width: 300px;
  }
}
</style>
