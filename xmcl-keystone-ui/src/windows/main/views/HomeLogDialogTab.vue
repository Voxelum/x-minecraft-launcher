<template>
  <v-tab-item>
    <div style="min-height: 420px; max-height: 420px; overflow: auto">
      <transition
        name="fade-transition"
        mode="out-in"
      >
        <v-list
          v-if="content === '' && files.length !== 0"
          :key="0"
        >
          <v-list-item
            v-for="i in files"
            :key="i"
            v-ripple
            :disabled="loading"
            @click="openFile(i)"
          >
            <v-list-item-avatar>
              <v-icon>
                clear_all
              </v-icon>
            </v-list-item-avatar>
            <v-list-item-content>
              <v-list-item-title>{{ i }}</v-list-item-title>
            </v-list-item-content>
            <v-list-item-action>
              <v-btn
                icon
                color="white"
                text
                @click.prevent.stop="showFile(i)"
              >
                <v-icon>folder</v-icon>
              </v-btn>
            </v-list-item-action>
            <v-list-item-action>
              <v-btn
                icon
                color="red"
                text
                @click.prevent.stop="removeFile(i)"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-list-item>
        </v-list>
        <div
          v-else-if="content === '' && files.length === 0"
          style="height: 420px"
        >
          <v-container fill-height>
            <v-layout
              fill-height
              justify-center
              align-center
            >
              <h1 v-if="!loading">
                {{ $t('profile.logsCrashes.placeholder') }}
              </h1>
              <v-progress-circular
                v-else
                :size="100"
                color="white"
                indeterminate
              />
            </v-layout>
          </v-container>
        </div>
        <div
          v-else
          :key="1"
        >
          <v-card-title primary-title>
            {{ showedFile }}
            <v-spacer />
            <v-btn
              text
              @click="goBack"
            >
              <v-icon left>
                arrow_back
              </v-icon>
              {{ $t('back') }}
            </v-btn>
          </v-card-title>
          <v-textarea
            auto-grow
            autofocus
            box
            readonly
            hide-details
            :value="content"
            style="margin: 8px;"
          />
        </div>
      </transition>
    </div>
  </v-tab-item>
</template>

<script lang=ts>
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    files: required<string[]>(Array),
    getFileContent: required<(file: string) => Promise<string>>(Function),
    removeFile: required<(file: string) => Promise<void>>(Function),
    showFile: required<(file: string) => void>(Function),
    refreshing: required<boolean>(Boolean),
  },
  setup(props) {
    const content = ref('')
    const loading = ref(false)
    const showedFile = ref('')
    const goBack = () => {
      content.value = ''
      showedFile.value = ''
    }
    const openFile = async (name: string) => {
      loading.value = true
      showedFile.value = name
      content.value = await props.getFileContent(name).finally(() => { loading.value = false })
    }
    return {
      content,
      loading: computed(() => props.refreshing || loading.value),
      goBack,
      openFile,
      showedFile,
    }
  },
})
</script>

<style>
</style>
