
<template>
  <v-dialog :value="value" width="500" @input="$emit('input', $event)">
    <v-card>
      <v-container grid-list-md>
        <v-layout column fill-height style="padding: 0 30px;">
          <v-flex tag="h1" class="white--text" xs1>
            <span class="headline">{{ $t('user.challenges') }}</span>
          </v-flex>
          <v-flex v-if="waitingSecurity" grow />
          <v-flex v-if="waitingSecurity || challenges.length === 0" offset-xs4>
            <v-progress-circular indeterminate :width="7" :size="170" color="white" />
          </v-flex>
          <v-flex v-else xs1>
            <v-text-field v-for="(c, index) in challenges" :key="c.question.id" hide-details
                          :label="c.question.question" color="primary"
                          dark style="margin-bottom: 10px;" @input="challenges[index].answer.answer=$event;challegesError=undefined" />
          </v-flex>
          <v-alert :value="challegesError" type="error" transition="scale-transition">
            {{ (challegesError||{}).errorMessage }}
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

<script>
export default {
  props: {
    value: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      submittingChallenges: false,
      challenges: [],
      challegesError: undefined,
    };
  },
  computed: {
    offline() { return this.$repo.getters.offline; },
    security() { return this.$repo.state.user.security; },
    waitingSecurity() { return this.$repo.state.user.refreshingSecurity; },
  },
  watch: {
    value() {
      if (this.value) {
        this.checkSecurity();
      }
    },
  },
  mounted() {
  },
  methods: {
    checkSecurity() {
      if (this.offline) return;
      if (!this.security) {
        this.$emit('input', true);
      }
      this.$repo.dispatch('checkLocation').then(() => {
        if (!this.security) {
          this.$emit('input', true);
          this.$repo.dispatch('getChallenges').then((c) => {
            this.challenges = c;
          }, (e) => {
            this.challegesError = e;
          });
        }
      });
    },
    async doSumitAnswer() {
      this.submittingChallenges = true;
      await this.$nextTick();
      await this.$repo.dispatch('submitChallenges', JSON.parse(JSON.stringify(this.challenges.map(c => c.answer)))).then((resp) => {
      }).then(() => {
        if (this.security) {
          this.$emit('input', false);
        }
      }, (e) => {
        this.challegesError = e;
      }).finally(() => {
        this.submittingChallenges = false;
      });
    },
  },
};
</script>

<style>
</style>
