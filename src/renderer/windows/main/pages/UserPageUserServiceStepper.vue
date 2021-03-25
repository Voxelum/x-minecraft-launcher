<template>
  <v-stepper
    v-model="step"
    non-linear
    vertical
    style="max-height: 80vh; overflow-y: auto;"
  >
    <v-stepper-step
      :editable="!modify"
      step="1"
      :complete="step > 1"
    >
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
        @keypress.enter="onKeyPress"
      />
      <v-radio-group v-model="template">
        <v-radio
          :label="$t('user.service.authLibInjector')"
          :value="1"
        />
        <v-radio
          :label="$t('user.service.normal')"
          :value="0"
        />
      </v-radio-group>
      <v-layout row>
        <v-btn
          flat
          style
          @click="$emit('cancel')"
        >
          {{ $t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-flex shrink>
          <v-btn
            flat
            color="primary"
            :disabled="baseUrlError || !baseUrl || nameError"
            @click.native="step = 2"
          >
            {{ $t('next') }}
            <v-icon right>
              arrow_right
            </v-icon>
          </v-btn>
        </v-flex>
      </v-layout>
    </v-stepper-content>
    <v-stepper-step
      step="2"
      :editable="step > 2 && enableAuthService"
      :complete="step > 2"
    >
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
        <v-btn
          flat
          style
          @click="$emit('cancel')"
        >
          {{ $t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-flex shrink>
          <v-btn
            flat
            color="primary"
            @click.native="finish"
          >
            {{ $t('finish') }}
            <v-icon right>
              check
            </v-icon>
          </v-btn>
          <v-btn
            flat
            color="primary"
            @click.native="step = 3"
          >
            {{ $t('next') }}
            <v-icon right>
              arrow_right
            </v-icon>
          </v-btn>
        </v-flex>
      </v-layout>
    </v-stepper-content>
    <v-stepper-step
      step="3"
      :complete="step > 3"
      :editable="step > 1 && enableProfileService"
    >
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
        <v-btn
          flat
          style="margin-left: 0"
          @click="$emit('cancel')"
        >
          {{ $t('cancel') }}
        </v-btn>
        <v-spacer />
        <v-flex shrink>
          <v-btn
            flat
            color="primary"
            @click.native="finish"
          >
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

<script lang=ts>
import { defineComponent, reactive, toRefs, onMounted, watch, nextTick } from '@vue/composition-api'
import { useStore, useI18n } from '/@/hooks'

const HTTP_EXP = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/
export default defineComponent({
  props: {
    modify: {
      type: String,
      default: '',
    },
  },
  setup(props, context) {
    const { state, commit } = useStore()
    const { $t } = useI18n()
    const urlRules = [
      (value: string) => !!HTTP_EXP.test(value) || $t('user.service.invalidUrl'),
    ]
    const nameRules = [
      (value: string) => !!value || $t('user.service.requireName'),
      (value: string) => !state.user.authServices[value] || $t('user.service.duplicatedName'),
    ]
    const authOrder = ['hostName', 'authenticate', 'refresh', 'validate', 'invalidate', 'signout']
    const data = reactive({
      name: '',
      step: 0,
      template: 1,
      baseUrl: '',
      baseUrlError: false,
      nameError: false,

      enableProfileService: true,
      enableAuthService: true,

      newAuth: {
        hostName: '',
        authenticate: '',
        refresh: '',
        validate: '',
        invalidate: '',
        signout: '',
      },

      newProfileService: {
        profile: '',
        profileByName: '',
        texture: '',
      },
    })
    const dataRefs = toRefs(data)
    onMounted(() => {
      watch(dataRefs.step, () => {
        if (data.step > 1) {
          if (data.newAuth.hostName === '' &&
            data.newAuth.authenticate === '' &&
            data.newAuth.refresh === '' &&
            data.newAuth.validate === '' &&
            data.newAuth.invalidate === '' &&
            data.newAuth.signout === '') {
            if (!data.baseUrl.startsWith('http://') && !data.baseUrl.startsWith('https://')) {
              data.baseUrl = `http://${data.baseUrl}`
            }
            data.newAuth.hostName = `${data.baseUrl}`
            if (data.template === 0) {
              data.newAuth.authenticate = '/authenticate'
              data.newAuth.refresh = '/refresh'
              data.newAuth.validate = '/validate'
              data.newAuth.invalidate = '/invalidate'
              data.newAuth.signout = '/signout'
            } else {
              data.newAuth.authenticate = '/authserver/authenticate'
              data.newAuth.refresh = '/authserver/refresh'
              data.newAuth.validate = '/authserver/validate'
              data.newAuth.invalidate = '/authserver/invalidate'
              data.newAuth.signout = '/authserver/signout'
            }
          }

          if (data.newProfileService.profile === '' &&
            data.newProfileService.profileByName === '' &&
            data.newProfileService.texture === '') {
            if (data.template === 0) {
              data.newProfileService.profile = `${data.baseUrl}/session/minecraft/profile/\${uuid}`
            } else {
              data.newProfileService.profile = `${data.baseUrl}/sessionserver/session/minecraft/profile/\${uuid}`
            }
            data.newProfileService.profileByName = `${data.baseUrl}/users/profiles/minecraft/\${name}`
            data.newProfileService.texture = `${data.baseUrl}/user/profile/\${uuid}/\${type}`
          }
        }
      })
      if (props.modify !== '') {
        const authSeriv = state.user.authServices[props.modify]
        if (authSeriv) {
          data.newAuth = { ...authSeriv }
        }
        const profSeriv = state.user.profileServices[props.modify]
        if (profSeriv) {
          data.newProfileService = { ...profSeriv }
          delete (data.newProfileService as any).publicKey
        }
        data.enableProfileService = !!profSeriv
        data.enableAuthService = !!authSeriv

        data.name = props.modify

        nextTick().then(() => {
          data.step = 2
        })
      } else {
        data.enableProfileService = true
        data.enableAuthService = true
        data.newAuth = {
          hostName: '',
          authenticate: '',
          refresh: '',
          validate: '',
          invalidate: '',
          signout: '',
        }
        data.newProfileService = {
          profile: '',
          profileByName: '',
          texture: '',
        }
        nextTick().then(() => {
          data.step = 1
        })
      }
    })
    return {
      ...dataRefs,
      authOrder,
      urlRules,
      nameRules,
      finish() {
        commit('authService', { name: data.name, api: data.newAuth })
        commit('profileService', { name: data.name, api: data.newProfileService })

        context.emit('cancel')
      },
      onKeyPress() {
        if (!data.baseUrlError) {
          data.step = 2
        }
      },
    }
  },
})
</script>

<style>
</style>
