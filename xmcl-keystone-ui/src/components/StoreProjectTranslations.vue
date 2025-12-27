<template>
  <div>
    <v-subheader>
      {{ t('modpack.translationTeam') }}
    </v-subheader>
    <div
      v-if="!translations || translations.length === 0"
      class="text-gray-500 px-4 py-2"
    >
      {{ t('modpack.noTranslationsAvailable') }}
    </div>
    <v-list
      v-else
      color="transparent"
      class="xl:(flex-col flex) grid grid-cols-3"
    >
      <v-list-item
        v-for="trans of translations"
        :key="trans.id"
        @click="onClick(trans)"
      >
        <v-list-item-content>
          <v-list-item-title v-text="trans.name" />
          <v-list-item-subtitle v-text="trans.url" />
        </v-list-item-content>
        <v-list-item-action>
          <v-chip
            small
            outlined
          >
            {{ trans.language }}
          </v-chip>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </div>
</template>
<script lang="ts" setup>
export interface TranslationTeam {
  id: string
  name: string
  url: string
  language: string
}

const props = defineProps<{ translations?: TranslationTeam[] }>()

const { t } = useI18n()
const onClick = (trans: TranslationTeam) => {
  if (trans.url) {
    window.open(trans.url, 'browser')
  }
}
</script>
