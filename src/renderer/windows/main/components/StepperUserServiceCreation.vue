<template>
  <v-stepper v-model="step" non-linear vertical>
    <v-stepper-step :editable="!modify" step="1" :complete="step > 1">
      {{ $t('user.service.typeOfService') }}
    </v-stepper-step>
    <v-stepper-content step="1">
      <v-text-field
        v-model="name"
        style="width: 100%"
        :rules="nameRules"
        :label="$t('user.service.name')"
        @update:error="value => nameError = value"
      />
      <v-text-field
        v-model="baseUrl"
        persistent-hint
        style="width: 100%"
        :label="$t('user.service.baseUrl')"
        :hint="$t('user.service.baseUrlHint')"
        :rules="urlRules"
        @update:error="value => baseUrlError = value"
        @keypress="onKeyPress"
      />
      <v-radio-group v-model="template">
        <v-radio
          :label="$t('user.service.normal')"
          :value="0"
        />
        <v-radio
          :label="$t('user.service.authLibInjector')"
          :value="1"
        />
      </v-radio-group>
      <v-layout row>
        <v-btn flat style="" @click="$emit('cancel')">
          {{ $t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-flex shrink>
          <v-btn flat 
                 color="primary" 
                 :disabled="baseUrlError || !baseUrl || nameError" 
                 @click.native="step = 2">
            {{ $t('next') }}
            <v-icon right>
              arrow_right
            </v-icon>
          </v-btn>
        </v-flex>
      </v-layout>
    </v-stepper-content>
    <v-stepper-step step="2" :editable="step > 2 && enableAuthService" :complete="step > 2">
      {{ $t('user.service.authServiceDetail') }}
    </v-stepper-step>
    <v-stepper-content step="2">
      <v-text-field
        v-for="type in authOrder" 
        :key="type"
        v-model="newAuth[type]"
        style="margin-bottom: 10px;"
        :label="type === 'hostName' ? $t('user.service.hostName') : `API ${type}`"
        :rules="type === 'hostName' ? urlRules : []"
        :messages="[$t(`user.service.${type}Hint`)]"
      />
      <v-layout row>
        <v-btn flat style="" @click="$emit('cancel')">
          {{ $t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-flex shrink>
          <v-btn flat color="primary" @click.native="finish">
            {{ $t('finish') }}
            <v-icon right>
              check
            </v-icon>
          </v-btn>
          <v-btn flat color="primary" @click.native="step = 3">
            {{ $t('next') }}
            <v-icon right>
              arrow_right
            </v-icon>
          </v-btn>
        </v-flex>
      </v-layout>
    </v-stepper-content>
    <v-stepper-step step="3" :complete="step > 3" :editable="step > 1 && enableProfileService">
      {{ $t('user.service.profileServiceDetail') }}
    </v-stepper-step>
    <v-stepper-content step="3">
      <v-text-field
        v-for="type in Object.keys(newProfileService)"
        :key="type"
        v-model="newProfileService[type]"
        style="margin-bottom: 10px;"
        :label="$t(`user.service.${type}`)"
        :messages="[$t(`user.service.${type}Hint`)]"
      />
      <v-layout row>
        <v-btn flat style="margin-left: 0" @click="$emit('cancel')">
          {{ $t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-flex shrink>
          <v-btn flat color="primary" @click.native="finish">
            {{ $t('finish') }}
            <v-icon right>
              check
            </v-icon>
          </v-btn>
        </v-flex>
      </v-layout>
    </v-stepper-content>
  </v-stepper>
</template>

<script>
const HTTP_EXP = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;
export default {
  props: {
    modify: {
      type: String,
      default: '',
    },
  },
  data() {
    return {
      name: '',
      step: 0, 
      template: 0,
      baseUrl: '',
      baseUrlError: false,
      nameError: false,

      enableProfileService: true,
      enableAuthService: true,

      authOrder: ['hostName', 'authenticate', 'refresh', 'validate', 'invalidate', 'signout'],
      newAuth: {
        hostName: '',
        authenticate: '',
        refresh: '',
        validate: '',
        invalidate: '',
        signout: '',
      },
      urlRules: [
        value => !!HTTP_EXP.test(value) || this.$t('user.service.invalidUrl'),
      ],
      nameRules: [
        value => !!value || this.$t('user.service.requireName'),
        value => !this.$repo.state.user.authServices[value] || this.$t('user.service.duplicatedName'),
      ],
      newProfileService: {
        profile: '',
        profileByName: '',
        texture: '',
      },
    };
  },
  watch: {
    step() {
      if (this.step > 1) {
        if (this.newAuth.hostName === '' 
        && this.newAuth.authenticate === ''
        && this.newAuth.refresh === ''
        && this.newAuth.validate === ''
        && this.newAuth.invalidate === ''
        && this.newAuth.signout === '') {
          if (this.template === 0) {
            this.newAuth.hostName = `${this.baseUrl}`;
          } else {
            this.newAuth.hostName = `${this.baseUrl}/authserver`;
          }
          this.newAuth.authenticate = '/authenticate';
          this.newAuth.refresh = '/refresh';
          this.newAuth.validate = '/validate';
          this.newAuth.invalidate = '/invalidate';
          this.newAuth.signout = '/signout';
        }

        if (this.newProfileService.profile === '' 
        && this.newProfileService.profileByName === ''
        && this.newProfileService.texture === '') {
          if (this.template === 0) {
            this.newProfileService.profile = `${this.baseUrl}/session/minecraft/profile/\${uuid}`;
          } else {
            this.newProfileService.profile = `${this.baseUrl}/sessionserver/session/minecraft/profile/\${uuid}`;
          }
          this.newProfileService.profileByName = `${this.baseUrl}/users/profiles/minecraft/\${name}`;
          this.newProfileService.texture = `${this.baseUrl}/user/profile/\${uuid}/\${type}`;
        }
      } 
    },
  },
  mounted() {
    if (this.modify !== '') {
      const authSeriv = this.$repo.state.user.authServices[this.modify];
      if (authSeriv) {
        this.newAuth = { ...authSeriv };
      }
      const profSeriv = this.$repo.state.user.profileServices[this.modify];
      if (profSeriv) {
        this.newProfileService = { ...profSeriv };
        delete this.newProfileService.publicKey;
      }
      this.enableProfileService = !!profSeriv;
      this.enableAuthService = !!authSeriv;

      this.name = this.modify;

      this.$nextTick().then(() => {
        this.step = 2;
      });
    } else {
      this.enableProfileService = true;
      this.enableAuthService = true;
      this.newAuth = {
        hostName: '',
        authenticate: '',
        refresh: '',
        validate: '',
        invalidate: '',
        signout: '',
      };
      this.newProfileService = {
        profile: '',
        profileByName: '',
        texture: '',
      };
      this.$nextTick().then(() => {
        this.step = 1;
      });
    }
  },
  methods: {
    finish() {
      this.$repo.commit('authService', { name: this.name, api: this.newAuth });
      this.$repo.commit('profileService', { name: this.name, api: this.newProfileService });

      this.$emit('cancel');
    },
    onKeyPress(e) {
      if (e.code === 'Enter') {
        if (!this.baseUrlError) {
          this.step = 2;
        }
      }
    },
  },
};
</script>

<style>

</style>
