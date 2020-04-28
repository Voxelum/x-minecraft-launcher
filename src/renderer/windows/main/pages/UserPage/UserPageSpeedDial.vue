<template>
  <v-tooltip :close-delay="0" left>
    <template v-slot:activator="{ on }">
      <v-speed-dial
        v-if="security"
        v-model="fab"
        style="position:absolute; z-index: 3; bottom: 80px; right: 100px;"
        direction="top"
        :open-on-hover="true"
      >
        <template v-slot:activator>
          <v-btn
            v-model="fab"
            color="secondary"
            :disabled="disabled"
            fab
            v-on="on"
            @click="load"
            @mouseenter="enterEditBtn"
          >
            <v-icon>edit</v-icon>
          </v-btn>
        </template>
        <v-btn
          :disabled="disabled"
          color="secondary"
          fab
          small
          v-on="on"
          @click="upload"
          @mouseenter="enterLinkBtn"
        >
          <v-icon>link</v-icon>
        </v-btn>
        <v-btn
          :disabled="disabled"
          color="secondary"
          fab
          small
          v-on="on"
          @click="save"
          @mouseenter="enterSaveBtn"
        >
          <v-icon>save</v-icon>
        </v-btn>
      </v-speed-dial>
    </template>
    {{ hoverTextOnEdit }}
  </v-tooltip>
</template>

<script lang=ts>
import { createComponent, reactive, toRefs } from '@vue/composition-api';
import { useI18n } from '@/hooks';

interface Props {
  load(): void;
  upload(): void;
  save(): void;
  security: boolean;
  disabled: boolean;
}

export default createComponent<Props>({
  props: {
    load: Function,
    upload: Function,
    save: Function,
    disabled: Boolean,
    security: Boolean,
  },
  setup() {
    const { $t } = useI18n();
    const data = reactive({
      fab: false,
      hoverTextOnEdit: '',
    });
    return {
      ...toRefs(data),
      enterEditBtn() {
        data.hoverTextOnEdit = $t('user.skinImportFile');
      },
      enterLinkBtn() {
        data.hoverTextOnEdit = $t('user.skinImportLink');
      },
      enterSaveBtn() {
        data.hoverTextOnEdit = $t('user.skinSave');
      },
    };
  },
});
</script>

<style>
</style>
