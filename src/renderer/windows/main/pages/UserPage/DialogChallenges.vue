
<template>
  <v-dialog v-model="isShown" width="500">
    <v-card>
      <v-container grid-list-md>
        <v-layout column fill-height style="padding: 0 30px;">
          <v-flex tag="h1" class="white--text" xs1>
            <span class="headline">{{ $t('user.challenges') }}</span>
          </v-flex>
          <v-flex v-if="refreshingSecurity" grow />
          <v-flex v-if="refreshingSecurity || challenges.length === 0" offset-xs4>
            <v-progress-circular indeterminate :width="7" :size="170" color="white" />
          </v-flex>
          <v-flex v-else xs1>
            <v-text-field v-for="(c, index) in challenges" :key="c.question.id" hide-details
                          :label="c.question.question" color="primary"
                          dark style="margin-bottom: 10px;" @input="challenges[index].answer.id = $event; challegesError=undefined" />
          </v-flex>
          <v-alert :value="challegesError" type="error" transition="scale-transition">
            {{ challegesError ? challegesError.errorMessage : '' }}
          </v-alert>
          <v-flex d-flex grow />
          <v-flex d-flex shrink>
            <v-layout wrap>
              <v-flex d-flex xs12 class="white--text">
                <v-spacer />
                <a style="z-index: 1" href="https://account.mojang.com/me/changeSecretQuestions">{{ $t('user.forgetChallenges') }}</a>
              </v-flex>
              <v-flex d-flex xs12>
                <v-btn block :loading="submittingChallenges" color="primary" @click="doSumitAnswer">
                  <v-icon left dark>
                    check
                  </v-icon>
                  {{ $t('user.submitChallenges') }}
                </v-btn>
              </v-flex>
            </v-layout>
          </v-flex>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { MojangChallenge } from '@xmcl/user/mojang';
import { reactive, toRefs, onMounted, watch, createComponent } from '@vue/composition-api';
import { useDialogSelf, useCurrentUserStatus, useI18n } from '@/hooks';

export default createComponent({
  setup() {
    const { isShown, closeDialog, showDialog } = useDialogSelf('challenge');
    const { offline, security, refreshingSecurity, getChallenges, checkLocation, submitChallenges } = useCurrentUserStatus();
    const data = reactive({
      submittingChallenges: false,
      challenges: [] as MojangChallenge[],
      challegesError: undefined as (undefined | { errorMessage: string }),
    });
    function checkSecurity() {
      if (offline.value) return;
      if (!security.value) {
        closeDialog();
      }
      checkLocation().then(() => {
        if (!security.value) {
          showDialog();
          getChallenges().then((c) => {
            data.challenges = c;
          }, (e) => {
            data.challegesError = e;
          });
        }
      });
    }
    onMounted(() => {
      watch(isShown, (v) => {
        if (v) {
          checkSecurity();
        }
      });
    });

    return {
      ...toRefs(data),
      offline,
      security,
      refreshingSecurity,
      isShown,
      async doSumitAnswer() {
        data.submittingChallenges = true;
        // await this.$nextTick();
        await submitChallenges(JSON.parse(JSON.stringify(data.challenges.map(c => c.answer)))).then((resp) => {
        }).then(() => {
          if (security.value) {
            closeDialog();
          }
        }, (e) => {
          data.challegesError = e;
        }).finally(() => {
          data.submittingChallenges = false;
        });
      },
    };
  },
});
</script>

<style>
</style>
