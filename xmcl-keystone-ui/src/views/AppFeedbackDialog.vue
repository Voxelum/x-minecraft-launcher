<template>
  <v-dialog v-model="isShown" hide-overlay transition="dialog-bottom-transition" width="600" scrollable>
    <v-card class="flex flex-col overflow-auto">
      <v-toolbar color="primary" dark flat>
        <v-toolbar-title class="d-flex align-center">
          <v-icon class="mr-2">feedback</v-icon>
          {{ t('feedback.name') }}
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="hide">
          <v-icon>close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text class="pa-0">
        <v-container fluid>
          <v-row>
            <v-col cols="12">
              <v-card flat class="pa-4 mb-4">
                <div class="d-flex align-center mb-2">
                  <v-icon color="primary" class="mr-2">info</v-icon>
                  <span class="text-h6">{{ t('feedback.description') }}</span>
                </div>
                <FeedbackCard />
              </v-card>
            </v-col>
          </v-row>

          <v-row>
            <v-col cols="12">
              <div class="d-flex align-center mb-3">
                <v-icon color="primary" class="mr-2">forum</v-icon>
                <span class="text-h6">{{ t('feedback.channel') }}</span>
              </div>

              <v-card v-for="(channel, index) in feedbackChannels" :key="index" class="mb-3" outlined hover>
                <v-card-text class="pa-4">
                  <div class="d-flex align-center justify-space-between">
                    <div class="d-flex align-center flex-grow-1">
                      <v-avatar :color="channel.color" size="40" class="mr-3">
                        <v-icon dark>{{ channel.icon }}</v-icon>
                      </v-avatar>
                      <div>
                        <div class="text-h6">{{ channel.title }}</div>
                        <div class="text-body-2 text--secondary">{{ channel.description }}</div>
                      </div>
                    </div>
                    <v-btn depressed rounded :color="channel.color" dark :href="channel.link" :target="channel.target">
                      {{ channel.buttonText }}
                      <v-icon right>open_in_new</v-icon>
                    </v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>
    </v-card>
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

<style scoped>
.diff {
  color: #81c784;
  font-style: italic;
}
</style>
