<template>
  <v-form
    lazy-validation
    style="height: 100%;"
    :value="valid"
    @input="$emit('update:valid', $event)"
  >
    <v-container
      grid-list
      fill-height
    >
      <v-layout
        row
        wrap
      >
        <v-flex
          d-flex
          xs4
        >
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
        <v-flex
          d-flex
          xs4
        >
          <v-text-field
            v-model="author"
            dark
            persistent-hint
            :hint="$t('profile.authorHint')"
            :label="$t('author')"
            required
          />
        </v-flex>
        <v-flex
          d-flex
          xs4
        >
          <minecraft-version-menu @input="runtime.minecraft = $event">
            <template #default="{ on }">
              <v-text-field
                v-model="runtime.minecraft"
                dark
                append-icon="arrow"
                persistent-hint
                :hint="$t('profile.versionHint')"
                :label="$t('minecraft.version')"
                :readonly="true"
                @click:append="on.keydown"
                v-on="on"
              />
            </template>
          </minecraft-version-menu>
        </v-flex>
        <v-flex
          d-flex
          xs12
        >
          <v-text-field
            v-model="description"
            dark
            persistent-hint
            :hint="$t('profile.descriptionHint')"
            :label="$t('description')"
          />
        </v-flex>
      </v-layout>
    </v-container>
  </v-form>
</template>

<script lang=ts>
import { defineComponent, inject } from '@vue/composition-api'
import { CreateOptionKey } from './creation'
import { useI18n } from '/@/hooks'
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
    const nameRules = [
      (v: any) => !!v || $t('profile.requireName'),
    ]
    return {
      nameRules,
      ...content,
    }
  },
})
</script>
