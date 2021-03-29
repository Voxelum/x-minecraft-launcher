<template>
  <v-list
    two-line
    style="overflow-y: auto; background: transparent;"
  >
    <v-list-tile
      v-for="item in items"
      :key="item.path"
      avatar
      :class="{ green: item.path === value.path && item.valid, red: item.path === value.path && !item.valid }"
      @click="$emit('input', item)"
    >
      <v-list-tile-avatar>
        <v-chip
          label
          small
          :color="item.valid ? 'orange' : 'grey'"
          outline
        >
          {{ item.majorVersion }}
        </v-chip>
      </v-list-tile-avatar>
      <v-list-tile-content>
        <v-list-tile-title v-if="item.valid">
          Java {{ item.version }}
        </v-list-tile-title>
        <v-list-tile-title v-else>
          {{ $t('java.invalid') }}
        </v-list-tile-title>
        <v-list-tile-sub-title>{{ item.path }}</v-list-tile-sub-title>
      </v-list-tile-content>
      <v-list-tile-action>
        <v-btn
          v-if="item.valid"
          icon
          @click.stop="showItemInDirectory(item.path)"
        >
          <v-icon>folder</v-icon>
        </v-btn>
      </v-list-tile-action>
      <v-list-tile-action>
        <v-btn
          icon
          @click.stop="remove(item)"
        >
          <v-icon>delete</v-icon>
        </v-btn>
      </v-list-tile-action>
    </v-list-tile>
  </v-list>
</template>

<script lang=ts>
import {
  reactive,
  defineComponent,
  toRefs,
} from '@vue/composition-api'
import { JavaRecord } from '/@shared/entities/java'
import { useService } from '/@/hooks'
import { required } from '/@/util/props'
import { BaseServiceKey } from '/@shared/services/BaseService'

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
