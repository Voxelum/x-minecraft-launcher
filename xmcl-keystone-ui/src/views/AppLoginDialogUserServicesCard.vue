<template>
  <div>
    <v-card-text
      style="padding-left: 50px; padding-right: 50px; padding-bottom: 25px;"
    >
      <v-list two-line>
        <template v-for="(s) in services">
          <v-list-item :key="s.value">
            <v-list-item-action>
              <v-btn
                :disabled="s.value === 'mojang'"
                text
                icon
                @click="newOrEdit(s)"
              >
                <v-icon>edit</v-icon>
              </v-btn>
            </v-list-item-action>
            <v-list-item-content>
              <v-list-item-title>{{ s.text }}</v-list-item-title>
              <v-list-item-subtitle>{{ t('user.authMode') }}: {{ s.body.hostName }}</v-list-item-subtitle>
              <v-list-item-subtitle>{{ t('user.profileMode') }}: {{ s.body.profile }}</v-list-item-subtitle>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                :disabled="s.value === 'mojang'"
                text
                icon
                color="error"
                @click="remove(s)"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </template>
        <v-list-item
          key="0"
          ripple
          @click="newOrEdit(undefined)"
        >
          <v-list-item-action>
            <v-icon>add</v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{ t('userService.add') }}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-card-text>
  </div>
</template>

<script lang=ts setup>
import { UserServiceKey } from '@xmcl/runtime-api'
import { useRefreshable, useService } from '@/composables'

interface ServiceItem {
  text: string
  value: string
  body: any
}

const emit = defineEmits(['route'])
const { t } = useI18n()

const data = reactive({
  editingService: -1,
  authOrProfile: 0,

  loading: '',

  newAuthServiceName: '',
  newAuthServiceHost: '',
})

const services = [] as any[]

const { refresh, refreshing } = useRefreshable(async () => {
  // const services = await getThirdpartyServices()
  // return services.map(({ name, authService, profileService }) => ({
  //   text: name,
  //   value: name,
  //   body: {
  //     ...authService,
  //     ...profileService,
  //   },
  // }))
})

function remove(s: ServiceItem) {
  // removeThirdpartyService(s.value)
}

function newOrEdit(s?: ServiceItem) {
  if (s) {
    data.loading = s.value
  } else {
    data.loading = ''
  }
  emit('route', 'edit-service')
}
</script>

<style>
.input-group {
  padding-top: 5px;
}
.password {
  padding-top: 5px;
}
.input-group--text-field label {
  top: 5px;
}
</style>
