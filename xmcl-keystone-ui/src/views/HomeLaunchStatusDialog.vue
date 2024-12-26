<template>
  <v-dialog
    v-model="isShown"
    :width="javaIssue ? 580 : 380"
  >
    <v-card class="h-full flex select-none flex-col">
      <v-card-title v-if="exiting">
        {{ t('launchStatus.exit') }}
      </v-card-title>
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

      <div
        class="flex p-3 gap-3"
      >
        <v-btn
          v-if="exiting || javaIssue"
          text
          @click="onCancel"
        >
          {{ t('cancel') }}
        </v-btn>
        <div class="flex-grow" />
        <v-btn
          v-if="exiting"
          text
          color="red"
          @click="onKill"
        >
          <v-icon left>
            exit_to_app
          </v-icon>
          {{ t('yes') }}
        </v-btn>
        <template v-if="javaIssue && !selected">
          <v-btn
            color="warning"
            :loading="selected"
            text
            @click="onLaunchAnyway"
          >
            <v-icon left>
              play_arrow
            </v-icon>
            {{ t('launch.launchAnyway') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="selected"
            @click="selectLocalJava"
          >
            <v-icon left>
              play_arrow
            </v-icon>
            {{ t('HomeJavaIssueDialog.optionSwitch.name', {
              version: status?.javaVersion ?
                status?.javaVersion.majorVersion : status?.javaVersion ? status?.javaVersion.majorVersion : '' }) }}
          </v-btn>
        </template>
        <v-btn
          v-if="refreshUserTimeout"
          text
          color="primary"
          @click="skipRefresh()"
        >
          <v-icon>
            skip_next
          </v-icon>
          {{ t('shared.skipForNow') }}
        </v-btn>
        <v-btn
          v-if="authLibTimeout"
          text
          color="primary"
          @click="skipAuthLib()"
        >
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

const { t } = useI18n()
const { launching, windowReady, kill, launchingStatus, launch, skipRefresh, skipAuthLib } = injection(kInstanceLaunch)
const { bypass } = injection(kInstanceJavaDiagnose)
const exiting = ref(false)
const selected = ref(false)
const javaIssue = ref<'invalid' | 'incompatible' | undefined>()
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
