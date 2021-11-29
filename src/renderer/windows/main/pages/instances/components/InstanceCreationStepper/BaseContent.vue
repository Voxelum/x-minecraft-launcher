<template>
  <v-form
    lazy-validation
    style="height: 100%;"
    :value="valid"
    @input="$emit('update:valid', $event)"
  >
    <v-list three-line subheader style="background: transparent; width: 100%">
      <v-list-tile>
        <div class="flex gap-4">
          <v-flex d-flex xs3>
            <v-text-field
              v-model="name"
              dark
              persistent-hint
              :hint="$t('profile.nameHint')"
              :label="$t('name')"
              :rules="nameRules"
              required
            />
          </v-flex>
          <v-flex d-flex xs3>
            <v-text-field
              v-model="author"
              dark
              persistent-hint
              :hint="$t('profile.authorHint')"
              :label="$t('author')"
              required
            />
          </v-flex>
          <v-flex d-flex>
            <v-text-field
              v-model="description"
              dark
              persistent-hint
              :hint="$t('profile.descriptionHint')"
              :label="$t('description')"
            />
          </v-flex>
        </div>
      </v-list-tile>
    </v-list>
  </v-form>
</template>

<script lang=ts>
import { computed, defineComponent, inject } from '@vue/composition-api'
import MinecraftVersionMenu from '../MinecraftVersionMenu.vue'
import { CreateOptionKey } from './creation'
import { useI18n } from '/@/hooks'
import { required } from '/@/util/props'
import FabricVersionMenu from '../FabricVersionMenu.vue'
import ForgeVersionMenu from '../ForgeVersionMenu.vue'

export default defineComponent({
  props: {
    valid: required(Boolean),
  },
  components: { MinecraftVersionMenu, ForgeVersionMenu, FabricVersionMenu },
  emits: ['update:valid'],
  setup() {
    const { $t } = useI18n()
    const content = inject(CreateOptionKey)
    if (!content) {
      throw new Error('Cannot use without providing CreateOption!')
    }
    const nameRules = computed(() => [
      (v: any) => !!v || $t('profile.requireName'),
    ])
    return {
      nameRules,
      ...content,
    }
  },
})
</script>
