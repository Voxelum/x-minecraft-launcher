<template>
  <v-dialog
    v-model="isShown"
    hide-overlay
    transition="dialog-bottom-transition"
    width="500"
  >
    <v-toolbar color="warning">
      <v-toolbar-title>{{ t('feedback.name') }}</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon
        @click="hide"
      >
        <v-icon>close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-list
      three-line
      subheader
    >
      <v-subheader>{{ t('feedback.description') }}</v-subheader>

      <FeedbackCard />
      <v-subheader> {{ t('feedback.channel') }} </v-subheader>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ t('feedback.github') }}</v-list-item-title>
          <v-list-item-subtitle>{{ t('feedback.githubDescription') }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn
            text
            href="https://github.com/Voxelum/x-minecraft-launcher/issues/new"
          >
            {{ t('feedback.githubOpenIssue') }}
          </v-btn>
        </v-list-item-action>
      </v-list-item>
      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ t('feedback.kook') }}</v-list-item-title>
          <v-list-item-subtitle
            style="max-width: 80%"
          >
            {{ t('feedback.kookDescription') }}
          </v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action>
          <v-btn
            text
            href="https://kook.top/gqjSHh"
          >
            {{ t('feedback.qqEnterGroup') }}
          </v-btn>
        </v-list-item-action>
      </v-list-item>

      <v-list-item>
        <v-list-item-content>
          <v-list-item-title>{{ t('feedback.discord') }}</v-list-item-title>
          <v-list-item-subtitle
            style="max-width: 80%"
          >
            {{ t('feedback.discordDescription') }}
          </v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action>
          <v-btn
            text
            href="https://discord.gg/W5XVwYY7GQ"
          >
            {{ t('feedback.discordJoin') }}
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </v-dialog>
</template>

<script lang=ts setup>
import FeedbackCard from '../components/FeedbackCard.vue'
import { useDialog } from '../composables/dialog'
import { useI18n } from '/@/composables'

const { hide, isShown } = useDialog('feedback')
const { t } = useI18n()

</script>

<style>
.diff {
  color: #81c784;
  font-style: italic;
}
</style>

<i18n locale="en" lang="yaml">
feedback:
  name: Feedback
  description: I found a Bug or I want to make a suggestion

  channel: Channels
  discord: Discord
  discordDescription: Join Discord Channel
  discordJoin: Join
  github: Github Issue
  githubDescription: Open an Github Issue to tell your thought
  githubOpenIssue: Github
  qq: QQ Group
  qqDescription: >-
    Enter the feedback QQ group and direct talk with authors. Group Number:
    {number}
  qqEnterGroup: Join
</i18n>

<i18n locale="zh-CN" lang="yaml">
feedback:
  name: 反馈
  description: 我找到了一个BUG/我想反馈
  channel: 联系渠道

  discord: Discord
  discordDescription: 加入 Discord 讨论组
  discordJoin: 加入
  github: Github Issue
  githubDescription: 通过 Github Issue 来反应你的想法
  githubOpenIssue: Github
  qq: QQ 群
  qqDescription: 加入反馈群直接和作者聊聊吧，群号 {number}
  qqEnterGroup: 加群
</i18n>

<i18n locale="ru" lang="yaml">
feedback:
  name: Обратная связь
  description: Я обнаружил ошибку или хочу сделать предложение
  discord: Discord
  discordDescription: Присоединяйтесь к каналу в Discord
  discordJoin: Присоединиться
  github: Github Issue
  githubDescription: Откройте Issue на Github, чтобы рассказать о предложении
  githubOpenIssue: Github
  qq: Группа QQ
  qqDescription: >-
    Войдите в группу для отзывов на QQ и поговорите с авторами напрямую. Номер
    группы: {number}
  qqEnterGroup: Присоединиться
</i18n>
