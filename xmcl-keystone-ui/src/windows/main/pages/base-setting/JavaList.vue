14<template>
  <v-list
    two-line
    style="overflow-y: auto; background: transparent;"
  >
    <v-list-item
      v-for="item in items"
      :key="item.path"
      :class="{ green: item.path === value.path && item.valid, red: item.path === value.path && !item.valid }"
      @click="$emit('input', item)"
    >
      <v-list-item-avatar>
        <v-chip
          label
          small
          :color="item.valid ? 'orange' : 'grey'"
          outlined
        >
          {{ item.majorVersion }}
        </v-chip>
      </v-list-item-avatar>
      <v-list-item-content>
        <v-list-item-title v-if="item.valid">
          Java {{ item.version }}
        </v-list-item-title>
        <v-list-item-title v-else>
          {{ $t('java.invalid') }}
        </v-list-item-title>
        <v-list-item-subtitle>{{ item.path }}</v-list-item-subtitle>
      </v-list-item-content>
      <v-list-item-action>
        <v-btn
          v-if="item.valid"
          icon
          @click.stop="showItemInDirectory(item.path)"
        >
          <v-icon>folder</v-icon>
        </v-btn>
      </v-list-item-action>
      <v-list-item-action>
        <v-btn
          icon
          @click.stop="remove(item)"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </v-list-item-action>
    </v-list-item>
  </v-list>
</template>

<script lang=ts>
import {
  defineComponent,
} from '@vue/composition-api'
import { JavaRecord, BaseServiceKey } from '@xmcl/runtime-api'
import { useService } from '/@/hooks'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    items: required<JavaRecord[]>(Array),
    value: required<JavaRecord>(Object),
    remove: required<(java: JavaRecord) => void>(Function),
  },
  setup(props) {
    const { showItemInDirectory } = useService(BaseServiceKey)
    return { showItemInDirectory }
  },
})
</script>
