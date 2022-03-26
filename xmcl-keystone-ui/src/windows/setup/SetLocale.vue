<template>
  <v-list
    class="non-moveable"
    three-line
    subheader
    style="background: transparent; width: 100%"
  >
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title class="flex-wrap whitespace-pre-wrap">
          {{ $t('step.locale.description') }}
        </v-list-item-title>
      </v-list-item-content>
    </v-list-item>
    <v-list-item>
      <v-list-item-content>
        <v-list-item-title>
          {{
            $t("step.locale.language")
          }}
        </v-list-item-title>
      </v-list-item-content>
      <v-list-item-action>
        <v-select
          :value="value"
          filled
          style="max-width: 185px"
          hide-details

          :items="locales"
          @input="$emit('input', $event)"
        />
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>
<script lang=ts>
import { defineComponent } from '@vue/composition-api'
import { required } from '/@/util/props'
import localMapping from '/@/assets/localeMapping.json'

export default defineComponent({
  props: {
    value: required(String),
  },
  setup() {
    return {
      locales: [
        'en',
        'zh-CN',
        'ru',
      ].map(l => ({ text: (localMapping as any)[l] ?? l, value: l })),
    }
  },
})
</script>
