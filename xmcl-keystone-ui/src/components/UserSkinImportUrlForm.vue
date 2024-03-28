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
            v-model="data.url"
            :rules="rules"
            :label="t('userSkin.placeUrlHere')"
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
            :disabled="data.error"
            @click="submit"
          >
            <v-icon left>
              inbox
            </v-icon>
            {{ t('userSkin.import') }}
          </v-btn>
        </v-flex>
      </v-layout>
    </v-container>
  </v-card>
</template>

<script lang=ts setup>

// https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
const URL_PATTERN = new RegExp('^(https?:\\/\\/)?' + // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
  '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
  '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
  '(\\#[-a-z\\d_]*)?$', 'i') // fragment locator

const { t } = useI18n()
const emit = defineEmits(['input'])
const rules = [
  (v: any) => !!v || t('userSkin.urlNotEmpty'),
  (v: any) => !!URL_PATTERN.test(v) || t('userSkin.urlNotValid'),
]
const data = reactive({
  error: true,
  url: '',
})
function validate() {
  data.error = rules.some(r => typeof r(data.url) === 'string')
}
function submit() {
  emit('input', data.url)
}
</script>

<style>
</style>
