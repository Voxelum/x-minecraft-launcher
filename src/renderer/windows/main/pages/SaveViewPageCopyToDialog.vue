<template>
  <v-dialog :value="value" width="500" persistent>
    <v-card>
      <v-card-title
        class="headline"
        primary-title
      >
        {{ $t('save.copy.title') }}
      </v-card-title>
      <v-card-text>
        {{ $t('save.copy.description') }}
      </v-card-text>

      <v-card-text>
        <v-checkbox v-for="(p, index) of instances" :key="index"
                    v-model="selected[index]"
                    hide-details
                    :label="p.name"
        />
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="red"
          flat
          @click="cancel"
        >
          {{ $t('save.copy.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          flat
          @click="operate"
        >
          {{ $t('save.copy.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts>
import { defineComponent, ref } from '@vue/composition-api';

export interface Props {
  cancel: () => void;
  operate: (instances: string[]) => void;
  value: string;
  instances: string[];
}

export default defineComponent<Props>({
  props: {
    cancel: {
      type: Function,
      required: true,
    },
    operate: {
      type: Function,
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
    instances: {
      type: Array,
      required: true,
    },
  },
  setup(props) {
    const selected = ref(new Array<string>(props.instances.length));
    return {
      selected,
      doOperation() {
        const func = props.operate;
        func(props.instances.filter((_, index) => selected.value[index]));
      },
    };
  },
});
</script>

<style>
</style>
