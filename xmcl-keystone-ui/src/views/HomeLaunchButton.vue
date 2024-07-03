<template>
  <div class="flex flex-grow-0 gap-[3px]">
    <v-badge
      left
      color="primary"
      bordered
      overlap
      :value="count !== 0"
    >
      <template #badge>
        <span v-ripple>{{ count }}</span>
      </template>
      <v-btn
        id="launch-button"
        :color="color"
        :x-large="!compact"
        :large="compact"
        class="px-12 text-lg transition-all btn-left"
        @click="onClick()"
        @mouseenter="emit('mouseenter')"
        @mouseleave="emit('mouseleave')"
      >
        <v-icon
          v-if="leftIcon"
          class="-ml-1 pr-2 text-2xl"
        >
          {{ leftIcon }}
        </v-icon>
        {{ text }}
        <v-icon
          v-if="!loading && icon"
          right
          class="pl-3 text-2xl"
        >
          {{ icon }}
        </v-icon>
        <v-progress-circular
          v-else-if="loading"
          class="v-icon--right"
          indeterminate
          :size="20"
          :width="2"
        />
      </v-btn>
    </v-badge>
    <v-menu
      v-model="isShown"
      offset-y
      left
      transition="scroll-y-transition"
    >
      <template #activator="{ on }">
        <v-btn
          class="min-w-unset! max-w-5! px-0! btn-right"
          :color="color"
          :x-large="!compact"
          :large="compact"
          v-on="on"
        >
          <v-icon>
            arrow_drop_down
          </v-icon>
        </v-btn>
      </template>
      <v-list dense>
        <v-list-item @click>
          <v-list-item-title>
            Check integrety
          </v-list-item-title>
        </v-list-item>
        <v-list-item @click="onInstallServer">
          <v-list-item-title>
            Install Server
          </v-list-item-title>
        </v-list-item>
        <v-list-item @click="onLaunchServer">
          <v-list-item-title>
            Launch Server
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>
    <v-dialog
      v-model="model"
      width="400"
    >
      <v-card>
        <v-card-title>
          <span class="text-h6">Minecraft EULA</span>
        </v-card-title>
        <v-card-text>
          By click {{ t('shared.accept') }} button below, you are indicating your agreement to our
          <a
            href="https://aka.ms/MinecraftEULA"
            target="_blank"
          >EULA</a>.
        </v-card-text>
        <v-card-actions>
          <v-btn
            text
            @click="cancel"
          >
            <v-icon left>
              close
            </v-icon>
            {{ t('cancel') }}
          </v-btn>
          <div class="flex-grow" />
          <v-btn
            text
            color="primary"
            @click="confirm"
          >
            <v-icon left>
              check
            </v-icon>
            {{ t('shared.accept') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
<script lang="ts" setup>
import { useService } from '@/composables'
import { useSimpleDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { kInstanceVersion } from '@/composables/instanceVersion'
import { useInstanceServerDiagnose } from '@/composables/instanceVersionDiagnose'
import { kInstanceVersionInstall } from '@/composables/instanceVersionInstall'
import { kLaunchButton } from '@/composables/launchButton'
import { injection } from '@/util/inject'
import { InstanceOptionsServiceKey } from '@xmcl/runtime-api'

defineProps<{ compact?: boolean }>()
const emit = defineEmits(['mouseenter', 'mouseleave'])

const { onClick, color, icon, text, loading, leftIcon, count } = injection(kLaunchButton)
const { installServer } = injection(kInstanceVersionInstall)
const { runtime, path } = injection(kInstance)
const { resolvedVersion } = injection(kInstanceVersion)
const { diagnoseVanillaServerJar } = useInstanceServerDiagnose(resolvedVersion)
const { t } = useI18n()

const isShown = ref(false)
const isReady = ref(false)

const onInstallServer = async () => {
  const version = resolvedVersion.value
  const runtimeValue = (!!version && ('requirements' in version)) ? version.requirements : runtime.value
  const resolveValue = (!!version && !('requirements' in version)) ? version : undefined
  await installServer(runtimeValue, path.value, resolveValue)
}

const {
  model,
  show,
  confirm,
  cancel,
} = useSimpleDialog<boolean>((target) => {
  if (target) {
    setEULA(path.value, target).then(() => {
      launch('server')
    })
  }
})
const { launch } = injection(kInstanceLaunch)
const { getEULA, setEULA } = useService(InstanceOptionsServiceKey)
const onLaunchServer = async () => {
  const isAccept = await getEULA(path.value)
  if (!isAccept) {
    show(true)
  } else {
    launch('server')
  }
}

watch(isShown, (v) => {
  if (!v) return
  // diagnoseVanillaServerJar().then((hasIssue) => {
  //   isReady.value = !hasIssue
  // }, () => {
  //   isReady.value = false
  // })
})

</script>

<style scoped>
.btn-right {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}
.btn-left {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>
