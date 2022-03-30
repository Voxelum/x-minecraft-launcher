<template>
  <v-card
    outlined
    class="flex gap-2 p-2 flex-0 flex-grow-0 items-center"
  >
    <v-card-title>{{ $tc('user.info', 2) }}</v-card-title>
    <v-spacer />
    <v-tooltip bottom>
      <template #activator="{ on }">
        <v-btn
          icon
          large
          v-on="on"
          @click="$emit('refresh')"
        >
          <v-icon>refresh</v-icon>
        </v-btn>
      </template>
      {{ $t('user.refreshAccount') }}
    </v-tooltip>
    <v-tooltip bottom>
      <template #activator="{ on }">
        <v-btn
          icon
          large
          v-on="on"
          @click="$emit('addaccount')"
        >
          <v-icon>person_add</v-icon>
        </v-btn>
      </template>
      {{ $t('user.account.add') }}
    </v-tooltip>
  </v-card>
</template>
<script lang="ts">
export default defineComponent({
  emits: ['addaccount', 'refresh', 'addservice'],
})
</script>
