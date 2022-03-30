<template>
  <v-form
    lazy-validation
    style="height: 100%;"
    :value="valid"
    @input="$emit('update:valid', $event)"
  >
    <v-list
      three-line
      subheader
      style="background: transparent; width: 100%"
    >
      <v-list-item>
        <div class="flex gap-4 mt-4">
          <v-flex
            d-flex
            xs3
          >
            <v-text-field
              v-model="name"
              outlined
              persistent-hint
              :hint="$t('profile.nameHint')"
              :label="$t('name')"
              :rules="nameRules"
              required
            />
          </v-flex>
          <v-flex
            d-flex
            xs3
          >
            <v-text-field
              v-model="author"
              outlined
              persistent-hint
              :hint="$t('profile.authorHint')"
              :label="$t('author')"
              required
            />
          </v-flex>
          <v-flex d-flex>
            <v-text-field
              v-model="description"
              outlined
              persistent-hint
              :hint="$t('profile.descriptionHint')"
              :label="$t('description')"
            />
          </v-flex>
        </div>
      </v-list-item>
    </v-list>
  </v-form>
</template>

<script lang=ts>
import { CreateOptionKey } from '../composables/instanceCreation'
import { useI18n } from '/@/composables'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    valid: required(Boolean),
  },
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
