<template>
  <v-card>
    <v-container
      fluid
      grid-list-md
    >
      <v-layout
        row
        wrap
      >
        <v-flex
          d-flex
          xs12
        >
          <v-text-field
            v-model="url"
            :rules="rules"
            :label="$t('user.skinPlaceUrlHere')"
            validate-on-blur
            clearable
            @input="validate"
          />
        </v-flex>
        <v-flex
          d-flex
          xs12
        >
          <v-btn
            :disabled="error"
            @click="submit"
          >
            <v-icon left>
              inbox
            </v-icon>
            {{ $t('user.skinImport') }}
          </v-btn>
        </v-flex>
      </v-layout>
    </v-container>
  </v-card>
</template>

<script lang=ts>
import { useI18n } from '/@/composables'

// https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
const URL_PATTERN = new RegExp('^(https?:\\/\\/)?' + // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
  '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
  '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
  '(\\#[-a-z\\d_]*)?$', 'i') // fragment locator

export default defineComponent({
  setup(props, context) {
    const { $t } = useI18n()
    const rules = [
      (v: any) => !!v || $t('user.skinUrlNotEmpty'),
      (v: any) => !!URL_PATTERN.test(v) || $t('user.skinUrlNotValid'),
    ]
    const data = reactive({
      error: true,
      url: '',
    })
    function validate() {
      data.error = rules.some(r => typeof r(data.url) === 'string')
    }
    function submit() {
      context.emit('input', data.url)
    }
    return {
      ...toRefs(data),
      rules,
      validate,
      submit,
    }
  },
})
</script>

<style>
</style>
