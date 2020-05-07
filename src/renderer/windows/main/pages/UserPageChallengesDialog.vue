
<template>
  <v-dialog width="500" :value="value" @input="$emit('input', $event)">
    <v-card>
      <v-container grid-list-md>
        <v-layout column fill-height style="padding: 0 30px;">
          <v-flex tag="h1" class="white--text" xs1>
            <span class="headline">{{ $t('user.challenges') }}</span>
          </v-flex>
          <v-flex v-if="refreshing" grow />
          <v-flex v-if="refreshing || challenges.length === 0" offset-xs4>
            <v-progress-circular indeterminate :width="7" :size="170" color="white" />
          </v-flex>
          <v-flex v-else xs1>
            <v-text-field
              v-for="(c, index) in challenges"
              :key="c.question.id"
              hide-details
              :label="c.question.question"
              color="primary"
              dark
              style="margin-bottom: 10px;"
              @input="updateAnswer(index, $event)"
            />
          </v-flex>
          <v-alert
            :value="error"
            type="error"
            transition="scale-transition"
          >{{ error ? error.errorMessage : '' }}</v-alert>
          <v-flex d-flex grow />
          <v-flex d-flex shrink>
            <v-layout wrap>
              <v-flex d-flex xs12 class="white--text">
                <v-spacer />
                <a
                  style="z-index: 1"
                  href="https://account.mojang.com/me/changeSecretQuestions"
                >{{ $t('user.forgetChallenges') }}</a>
              </v-flex>
              <v-flex d-flex xs12>
                <v-btn block :loading="loading" color="primary" @click="submit">
                  <v-icon left dark>check</v-icon>
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
import { defineComponent } from '@vue/composition-api';
import { useUserSecurity } from '@/hooks';

export default defineComponent<{ value: boolean }>({
  props: {
    value: Boolean,
  },
  setup() {
    const { submit, challenges, error, security, refreshing, loading } = useUserSecurity();
    function updateAnswer(index: number, content: string) {
      challenges.value[index].answer.answer = content;
      error.value = undefined;
    }
    return {
      loading,
      updateAnswer,
      challenges,
      error,
      security,
      refreshing,
      submit,
    };
  },
});
</script>

<style>
</style>
