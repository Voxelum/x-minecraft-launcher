<template>
  <v-dialog
    v-model="isShown"
    :width="javaIssue ? 580 : 380"
  >
    <v-card class="h-full flex select-none flex-col launch-status-card">
      <v-card-item v-if="exiting">
        <v-card-title>
          {{ t('launchStatus.exit') }}
        </v-card-title>
      </v-card-item>
      <AppLoadingCircular
        v-if="launching || !windowReady || javaIssue"
        class="mb-4"
        :texts="launchingSteps"
        :secondary-hint="launchingStatus !== ''"
        :hint="hint"
      >
        <template v-if="!javaIssue">
          <div class="mx-10 my-3 flex flex-col items-center justify-center gap-1">
            <VTypical
              class="blink"
              :steps="launchingSteps"
            />
            <div
              v-if="hint"
              class="transition-all"
              :class="{ 'text-gray-500': launchingStatus !== '', 'text-transparent': !launchingStatus }"
            >
              {{ hint + '...' }}
            </div>
          </div>
        </template>
        <div
          v-else
          class="mt-5 flex flex-col items-center justify-center"
        >
          <div class="flex items-center gap-1">
            <v-icon
              size="15"
              color="red"
            >
              warning
            </v-icon>
            {{ javaHints[0] }}
            <v-icon
              size="15"
              color="red"
            >
              warning
            </v-icon>
          </div>
          <v-card-text class="py-1 text-center">
            {{ javaHints[1] }}
          </v-card-text>
        </div>
      </AppLoadingCircular>

      <v-alert
        v-if="showElyByWarning && !javaIssue"
        type="warning"
        dense
        outlined
        class="mx-3 mb-3"
      >
        <div class="text-sm">
          {{ t('launchStatus.elyByWarning') }}
        </div>
      </v-alert>

      <div
        class="flex p-3 gap-3"
      >
        <v-btn
          v-if="exiting || javaIssue"
          @click="onCancel"
         variant="text">
          {{ t('shared.cancel') }}
        </v-btn>
        <div class="flex-grow" />
        <v-btn
          v-if="exiting"
          color="red"
          @click="onKill"
         variant="text">
          <v-icon start>
            exit_to_app
          </v-icon>
          {{ t('shared.yes') }}
        </v-btn>
        <v-btn
          v-if="exiting"
          color="red darken-2"
          @click="onForceKill"
         variant="text">
          <v-icon start>
            dangerous
          </v-icon>
          {{ t('launch.forceKill') }}
        </v-btn>
        <template v-if="javaIssue && !selected">
          <v-btn
            color="warning"
            :loading="selected"
            @click="onLaunchAnyway"
           variant="text">
            <v-icon start>
              play_arrow
            </v-icon>
            {{ t('launch.launchAnyway') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="selected"
            @click="selectLocalJava"
          >
            <v-icon start>
              play_arrow
            </v-icon>
            {{ t('HomeJavaIssueDialog.optionSwitch.name', {
              version: status?.javaVersion ?
                status?.javaVersion.majorVersion : status?.javaVersion ? status?.javaVersion.majorVersion : '' }) }}
          </v-btn>
        </template>
        <v-btn
          v-if="refreshUserTimeout"
          color="primary"
          @click="skipRefresh()"
         variant="text">
          <v-icon>
            skip_next
          </v-icon>
          {{ t('shared.skipForNow') }}
        </v-btn>
        <v-btn
          v-if="authLibTimeout"
          color="primary"
          @click="skipAuthLib()"
         variant="text">
          {{ t('shared.skipForNow') }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>
import AppLoadingCircular from '@/components/AppLoadingCircular.vue'
import VTypical from '@/components/VTyping.vue'
import { useService } from '@/composables'
import { kInstance } from '@/composables/instance'
import { kInstanceJava } from '@/composables/instanceJava'
import { kInstanceLaunch } from '@/composables/instanceLaunch'
import { injection } from '@/util/inject'
import { InstanceServiceKey } from '@xmcl/runtime-api'
import { useDialog } from '../composables/dialog'
import { LaunchStatusDialogKey } from '../composables/launch'
import { kInstanceJavaDiagnose } from '@/composables/instanceJavaDiagnose'
import { kUserContext } from '@/composables/user'
import { kSettingsState } from '@/composables/setting'

const { t } = useI18n()
const { launching, windowReady, kill, launchingStatus, launch, skipRefresh, skipAuthLib } = injection(kInstanceLaunch)
const { bypass } = injection(kInstanceJavaDiagnose)
const { userProfile } = injection(kUserContext)
const { state: settings } = injection(kSettingsState)
const { instance } = injection(kInstance)

const exiting = ref(false)
const selected = ref(false)
const javaIssue = ref<'invalid' | 'incompatible' | undefined>()

const isElyBy = computed(() => userProfile.value.authority.indexOf('authserver.ely.by') !== -1)
const disableElyByAuthlib = computed(() => instance.value.disableElybyAuthlib ?? settings.value?.globalDisableElyByAuthlib ?? false)
const showElyByWarning = computed(() => isElyBy.value && !disableElyByAuthlib.value && launching.value)

const { isShown, show, hide } = useDialog(LaunchStatusDialogKey, (param) => {
  exiting.value = !!param?.isKill
  javaIssue.value = param?.javaIssue
}, () => {
  exiting.value = false
  selected.value = false
  refreshUserTimeout.value = false
  authLibTimeout.value = false
  javaIssue.value = undefined
})

const { path } = injection(kInstance)
const { editInstance } = useService(InstanceServiceKey)
async function selectLocalJava() {
  selected.value = true
  if (status.value?.preferredJava) {
    const javaPath = status.value.preferredJava.path
    await editInstance({ instancePath: path.value, java: javaPath })
    await launch('client', {
      java: javaPath,
    })
  }
}

const refreshUserTimeout = ref(false)
const authLibTimeout = ref(false)
watch(launchingStatus, (newStat) => {
  if (newStat === 'refreshing-user') {
    setTimeout(() => {
      if (launchingStatus.value === 'refreshing-user') {
        refreshUserTimeout.value = true
      }
    }, 5000)
  } else {
    refreshUserTimeout.value = false
  }
  if (newStat === 'preparing-authlib') {
    setTimeout(() => {
      if (launchingStatus.value === 'preparing-authlib') {
        authLibTimeout.value = true
      }
    }, 5000)
  } else {
    authLibTimeout.value = false
  }
})

const hint = computed(() => launchingStatus.value === 'preparing-authlib'
  ? t('launchStatus.injectingAuthLib')
  : launchingStatus.value === 'assigning-memory'
    ? t('launchStatus.assigningMemory')
    : launchingStatus.value === 'refreshing-user'
      ? t('launchStatus.refreshingUser')
      : launchingStatus.value === 'spawning-process'
        ? t('launchStatus.spawningProcess')
        : '')

const { status } = injection(kInstanceJava)
const javaHints = computed(() => {
  const type = javaIssue.value
  if (!type) {
    return []
  }

  const stat = status.value
  if (!stat) {
    return []
  }

  if (type === 'invalid') {
    return [t('diagnosis.invalidJava.name')]
  }
  if (type === 'incompatible') {
    return [
      t('HomeJavaIssueDialog.incompatibleJava', { javaVersion: stat.java?.version ?? stat.javaPath ?? '' }),
      t('diagnosis.incompatibleJava.name', { version: stat.preference.requirement, javaVersion: stat.java?.version || '' }),
    ]
  }
  return []
})

const launchingSteps = computed(() => [
  t('launchStatus.launching'),
  4000,
  t('launchStatus.launchingSlow'),
])

const onKill = () => {
  kill()
  hide()
}
const onForceKill = () => {
  // gh #1395 — force-terminate the JVM process tree when graceful kill fails.
  kill('client', true)
  hide()
}
const onCancel = () => hide()

watch(windowReady, (ready) => {
  if (ready && isShown.value) {
    hide()
  }
})

function onLaunchAnyway() {
  selected.value = true
  launch()
  bypass()
}
</script>

<style scoped="true">
.blink::after {
  content: '|';
  animation: blink 1s infinite step-start;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
