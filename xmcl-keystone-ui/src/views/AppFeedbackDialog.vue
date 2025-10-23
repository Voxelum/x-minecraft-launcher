<template>
  <v-dialog
    v-model="isShown"
    persistent
    transition="dialog-bottom-transition"
    max-width="600"
    content-class="feedback-dialog"
  >
    <v-card
      class="rounded-xl elevation-12"
      style="background: #1e1e1e; color: #ffffff"
    >
      <!-- Header -->
      <v-card-title
        class="d-flex align-center py-5 px-6"
        style="background: linear-gradient(135deg, #ff6f00, #ff9800)"
      >
        <v-icon large color="white" class="mr-3">chat_bubble_outline</v-icon>
        <span class="text-h5 font-weight-bold white--text">{{
          t("feedback.name")
        }}</span>
        <v-spacer />
        <v-btn icon large @click="hide" color="white" class="ml-2">
          <v-icon>close</v-icon>
        </v-btn>
      </v-card-title>

      <!-- Content -->
      <v-card-text class="pa-6">
        <p class="text-body-1 mb-6 grey--text text--lighten-1">
          {{ t("feedback.description") }}
        </p>

        <!-- Feedback Card -->
        <v-sheet
          class="mb-6 rounded-lg elevation-4 pa-4"
          color="grey darken-4"
          style="border-left: 4px solid #4caf50"
        >
          <FeedbackCard />
        </v-sheet>

        <!-- Channels Section -->
        <h3 class="text-h6 font-weight-medium mb-4 d-flex align-center">
          <v-icon left color="primary">chat_bubble_outline</v-icon>
          {{ t("feedback.channel") }}
        </h3>

        <!-- Channel List -->
        <v-list
          class="rounded-lg elevation-2 pa-0"
          dense
          style="background: #2a2a2a"
        >
          <!-- GitHub -->
          <v-list-item class="px-4 py-3" style="border-bottom: 1px solid #333">
            <v-list-item-content>
              <v-list-item-title class="font-weight-medium">{{
                t("feedback.github")
              }}</v-list-item-title>
              <v-list-item-subtitle
                class="mt-1 text-caption"
                style="
                  max-width: 100%;
                  word-break: break-word;
                  white-space: normal;
                "
              >
                {{ t("feedback.githubDescription") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                text
                target="_blank"
                href="https://github.com/Voxelum/x-minecraft-launcher/issues/new"
                class="success--text text-capitalize"
              >
                {{ t("feedback.githubOpenIssue") }}
                <v-icon right small>open_in_new</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>

          <!-- QQ -->
          <v-list-item class="px-4 py-3" style="border-bottom: 1px solid #333">
            <v-list-item-content>
              <v-list-item-title class="font-weight-medium">{{
                t("feedback.qq")
              }}</v-list-item-title>
              <v-list-item-subtitle
                class="mt-1 text-caption"
                style="
                  max-width: 100%;
                  word-break: break-word;
                  white-space: normal;
                "
              >
                {{ t("feedback.qqDescription", { number: 858391850 }) }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                text
                href="https://jq.qq.com/?_wv=1027&k=5Py5zM1"
                class="primary--text text-capitalize"
              >
                {{ t("feedback.qqEnterGroup") }}
                <v-icon right small>launch</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>

          <!-- KOOK -->
          <v-list-item class="px-4 py-3" style="border-bottom: 1px solid #333">
            <v-list-item-content>
              <v-list-item-title class="font-weight-medium">{{
                t("feedback.kook")
              }}</v-list-item-title>
              <v-list-item-subtitle
                class="mt-1 text-caption"
                style="
                  max-width: 100%;
                  word-break: break-word;
                  white-space: normal;
                "
              >
                {{ t("feedback.kookDescription") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                text
                target="_blank"
                href="https://kook.top/gqjSHh"
                class="info--text text-capitalize"
              >
                {{ t("feedback.qqEnterGroup") }}
                <v-icon right small>open_in_new</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>

          <!-- Discord -->
          <v-list-item class="px-4 py-3">
            <v-list-item-content>
              <v-list-item-title class="font-weight-medium">{{
                t("feedback.discord")
              }}</v-list-item-title>
              <v-list-item-subtitle
                class="mt-1 text-caption"
                style="
                  max-width: 100%;
                  word-break: break-word;
                  white-space: normal;
                "
              >
                {{ t("feedback.discordDescription") }}
              </v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                text
                target="_blank"
                href="https://discord.gg/W5XVwYY7GQ"
                class="indigo--text text-capitalize"
              >
                {{ t("feedback.discordJoin") }}
                <v-icon right small>open_in_new</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list>
      </v-card-text>

      <!-- Footer -->
      <v-card-actions class="pa-4 justify-center">
        <v-btn text @click="hide" class="mr-4" style="color: #ffffff">
          {{ t("cancel") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang="ts" setup>
import FeedbackCard from "../components/FeedbackCard.vue";
import { useDialog } from "../composables/dialog";

const { hide, isShown } = useDialog("feedback");
const { t } = useI18n();

watch(isShown, (v) => {
  if (v) {
    windowController.focus();
  }
});
</script>

<style scoped>
.feedback-dialog {
  margin: 0;
  padding: 0;
}

.v-application.theme--dark .feedback-dialog .v-card {
  background-color: #1e1e1e;
  color: #ffffff;
}

/* Ensure text wraps properly */
.v-list-item-subtitle {
  white-space: normal;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
</style>
