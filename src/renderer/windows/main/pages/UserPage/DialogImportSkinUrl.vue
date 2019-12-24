<template>
  <v-dialog v-model="isShown" width="400">
    <v-card dark>
      <v-container fluid grid-list-md>
        <v-layout row wrap>
          <v-flex d-flex xs12>
            <v-text-field v-model="skinUrl" 
                          :rules="skinUrlRules" 
                          :label="$t('user.skinPlaceUrlHere')"
                          validate-on-blur 
                          clearable 
                          @input="updateSkinUrl" />
          </v-flex>
          <v-flex d-flex xs12>
            <v-btn 
              :disabled="skinUrlError" 
              @click="updateSkin">
              <v-icon left>
                inbox
              </v-icon>
              {{ $t('user.skinImport') }}
            </v-btn>
          </v-flex>
        </v-layout>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { reactive, toRefs, createComponent } from '@vue/composition-api';
import { useI18n, useDialogSelf } from '@/hooks';

export default createComponent({
  setup() {
    // https://stackoverflow.com/questions/5717093/check-if-a-javascript-string-is-a-url
    const URL_PATTERN = new RegExp('^(https?:\\/\\/)?' // protocol
    + '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' // domain name
    + '((\\d{1,3}\\.){3}\\d{1,3}))' // OR ip (v4) address
    + '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' // port and path
    + '(\\?[;&a-z\\d%_.~+=-]*)?' // query string
    + '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    const { $t } = useI18n();
    const skinUrlRules = [
      (v: any) => !!v || $t('user.skinUrlNotEmpty'),
      (v: any) => !!URL_PATTERN.test(v) || $t('user.skinUrlNotValid'),
    ];
    const data = reactive({
      skinUrlError: true,
    });
    const { isShown, closeDialog, dialogResult: skinUrl } = useDialogSelf('skin-import');
    function updateSkinUrl() {
      data.skinUrlError = skinUrlRules.some(r => typeof r(skinUrl.value) === 'string');
    }
    function updateSkin() {
      closeDialog(skinUrl.value);
    }
    return {
      ...toRefs(data),
      skinUrl,
      skinUrlRules,
      updateSkinUrl,
      updateSkin,
      isShown,
    };
  },
});
</script>

<style>

</style>
