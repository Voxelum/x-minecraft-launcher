<template>
  <v-card
    outlined
    class="grid md:grid-cols-2 lg:grid-cols-1 3xl:grid-cols-2 p-6 gap-6 "
  >
    <div class="item">
      <v-icon class="material-icon-outlined">
        file_download
      </v-icon>
      <div>
        <span>{{ $t('modrinth.downloads') }}</span>
        {{ downloads }}
      </div>
    </div>
    <div class="item">
      <v-icon class="material-icon-outlined">
        event
      </v-icon>
      <div>
        <span>{{ $t('modrinth.createAt') }}</span>
        {{ new Date(createAt).toLocaleDateString() }}
      </div>
    </div>
    <div class="item">
      <v-icon class="material-icon-outlined">
        edit
      </v-icon>
      <div>
        <span>{{ $t('modrinth.avaiableFor') }}</span>
      </div>
    </div>
    <div class="item">
      <v-icon class="material-icon-outlined">
        edit
      </v-icon>
      <div>
        <span>{{ $t('modrinth.updateAt') }}</span>
        {{ new Date(updateAt).toLocaleDateString() }}
      </div>
    </div>
    <div class="item">
      <v-icon class="material-icon-outlined">
        desktop_windows
      </v-icon>
      <div>
        <span>{{ $t('modrinth.clientSide') }}</span>
        {{ clientSide }}
      </div>
    </div>
    <div class="item">
      <v-icon class="material-icon-outlined">
        storage
      </v-icon>
      <div>
        <span>{{ $t('modrinth.serverSide') }}</span>
        {{ serverSide }}
      </div>
    </div>
    <div class="item">
      <v-icon class="material-icon-outlined">
        description
      </v-icon>
      <div>
        <span>{{ $t('modrinth.license') }}</span>
        <a :href="license.url">
          {{ license.name }}
        </a>
      </div>
    </div>
    <div class="item">
      <v-icon class="material-icon-outlined">
        code
      </v-icon>
      <div>
        <span>{{ $t('modrinth.projectId') }}</span>
        {{ projectId }}
      </div>
    </div>
  </v-card>
</template>
<script lang="ts">
import { License } from '@xmcl/modrinth'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    downloads: required(Number),
    createAt: required(String),
    updateAt: required(String),
    license: required<License>(Object),
    serverSide: required(String),
    clientSide: required(String),
    projectId: required(String),
  },
  setup() {},
})
</script>

<style scoped>
.item {
  @apply flex items-center gap-2;
}

.item .v-icon {
 @apply rounded-full bg-[rgba(0,0,0,0.2)] p-2;
}

.item div {
  @apply flex flex-col;
}

</style>
