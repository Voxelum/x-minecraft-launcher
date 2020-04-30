<template>
  <v-combobox hide-details outline :label="label" :items="items" :value="value" multiple
              :search-input.sync="creating" :hide-no-data="!creating" @input="byPassInput">
    <template v-slot:no-data>
      <v-list-tile>
        <span class="subheading">{{ createHint }}</span>
        <v-chip label small>
          {{ creating }}
        </v-chip>
      </v-list-tile>
    </template>
    <template v-slot:selection="{ item, parent, selected }">
      <v-chip v-if="item === Object(item)" :selected="selected" label outline small style="margin: 10px 5px;">
        <span class="pr-2">
          {{ item.text }}
        </span>
        <v-icon small @click="parent.selectItem(item);">
          close
        </v-icon>
      </v-chip>
    </template>
    <template v-slot:item="{ item }">
      <v-list-tile-content>
        <v-text-field v-if="editing === item" v-model="editing.text" autofocus flat background-color="transparent"
                      hide-details solo @keyup.enter="edit(index, item)" />
        <v-chip v-else dark label small>
          {{ item.text }}
        </v-chip>
      </v-list-tile-content>
      <v-spacer />
      <v-list-tile-action @click.stop>
        <v-btn icon @click.stop.prevent="edit(index, item)">
          <v-icon>{{ editing !== item ? 'edit' : 'check' }}</v-icon>
        </v-btn>
      </v-list-tile-action>
      <v-list-tile-action @click.stop>
        <v-btn color="red" flat icon @click.stop.prevent="deleteItem(item)">
          <v-icon> close </v-icon>
        </v-btn>
      </v-list-tile-action>
    </template>
  </v-combobox>
</template>

<script lang=ts>
import Vue from 'vue';
import { defineComponent, reactive, toRefs } from '@vue/composition-api';

interface Item {
  header?: string;
  text: string;
}

export default defineComponent({
  props: {
    createHint: {
      type: String,
      default: '',
    },
    value: {
      type: Array,
      default: () => [],
    },
    hint: {
      type: String,
      default: '',
    },
    label: {
      type: String,
      default: '',
    },
  },
  setup(props, context) {
    const data = reactive({
      editing: null as null | Item,
      index: -1,
      items: [
        { header: props.hint },
      ] as { header?: string; text: string }[],
      creating: null,
    });
    return {
      ...toRefs(data),
      byPassInput(val: string[]) {
        context.emit('input', val.map((v) => {
          if (typeof v === 'string') {
            data.items.push({ text: v });
          }
          return v;
        }));
      },
      edit(index: number, item: Item) {
        if (!data.editing) {
          data.editing = item;
          data.index = index;
        } else {
          data.editing = null;
          data.index = -1;
        }
      },
      deleteItem(item: Item) {
        Vue.delete(data.items, data.items.indexOf(item));
      },
    };
  },
});
</script>

<style>
</style>
