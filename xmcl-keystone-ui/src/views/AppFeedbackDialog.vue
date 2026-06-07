<template>
  <v-dialog
    v-model="isShown"
    width="560"
    :persistent="false"
    transition="fade-transition"
    content-class="elevation-0"
  >
    <div class="flex w-full max-h-[85vh] flex-col overflow-hidden">
      <!-- Header -->
      <div class="flex items-center px-6 pt-6 pb-4">
        <div class="flex items-center gap-3 flex-grow">
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style="background-color: rgba(var(--v-theme-primary), 0.12)"
          >
            <v-icon size="22" color="primary">feedback</v-icon>
          </div>
          <div class="text-base font-bold tracking-tight" style="color: rgba(var(--v-theme-on-surface), 0.9);">
            {{ t('feedback.name') }}
          </div>
        </div>
        <v-btn
          icon="close"
          variant="text"
          size="small"
          @click="hide"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 min-h-0 overflow-y-auto invisible-scroll px-6 pb-6 flex flex-col gap-5">
        <!-- Description -->
        <div class="surface-panel p-4">
          <div class="mb-2 flex items-center gap-2">
            <v-icon size="18" color="primary">info</v-icon>
            <span class="text-sm font-semibold opacity-80">{{ t('feedback.description') }}</span>
          </div>
          <FeedbackCard :icon="false" />
        </div>

        <!-- Channels -->
        <div>
          <div class="mb-3 flex items-center gap-2">
            <v-icon size="18" color="primary">forum</v-icon>
            <span class="text-sm font-semibold opacity-80">{{ t('feedback.channel') }}</span>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-for="(channel, index) in feedbackChannels"
              :key="index"
              class="surface-panel group p-4 transition-all hover:bg-[rgba(var(--v-theme-on-surface),0.08)]"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="flex min-w-0 flex-grow items-center gap-3">
                  <v-avatar
                    :color="channel.color"
                    size="36"
                    class="flex-shrink-0"
                  >
                    <v-icon size="18" color="white">{{ channel.icon }}</v-icon>
                  </v-avatar>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm font-semibold">{{ channel.title }}</div>
                    <div class="text-xs opacity-60 break-words">
                      {{ channel.description }}
                    </div>
                  </div>
                </div>
                <v-btn
                  rounded="pill"
                  :color="channel.color"
                  :href="channel.link"
                  :target="channel.target"
                  variant="flat"
                  size="small"
                  class="flex-shrink-0"
                >
                  {{ channel.buttonText }}
                  <v-icon end size="14">open_in_new</v-icon>
                </v-btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script lang="ts" setup>
import FeedbackCard from '../components/FeedbackCard.vue'
import { useDialog } from '../composables/dialog'

const { hide, isShown } = useDialog('feedback')
const { t } = useI18n()

const feedbackChannels = computed(() => [
  {
    title: t('feedback.github'),
    description: t('feedback.githubDescription'),
    icon: 'code',
    color: 'black',
    link: 'https://github.com/Voxelum/x-minecraft-launcher/issues/new',
    target: 'browser',
    buttonText: t('feedback.githubOpenIssue')
  },
  {
    title: t('feedback.qq'),
    description: t('feedback.qqDescription', { number: 858391850 }),
    icon: 'chat',
    color: 'blue',
    link: 'https://jq.qq.com/?_wv=1027&k=5Py5zM1',
    target: '_blank',
    buttonText: t('feedback.qqEnterGroup')
  },
  {
    title: t('feedback.kook'),
    description: t('feedback.kookDescription'),
    icon: 'chat',
    color: 'purple',
    link: 'https://kook.top/gqjSHh',
    target: 'browser',
    buttonText: t('feedback.qqEnterGroup')
  },
  {
    title: t('feedback.discord'),
    description: t('feedback.discordDescription'),
    icon: 'discord',
    color: 'indigo darken-2',
    link: 'https://discord.gg/W5XVwYY7GQ',
    target: 'browser',
    buttonText: t('feedback.discordJoin')
  }
])

watch(isShown, (v) => {
  if (v) {
    windowController.focus()
  }
})
</script>
