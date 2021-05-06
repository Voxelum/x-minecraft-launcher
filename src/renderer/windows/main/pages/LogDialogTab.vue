<template>
  <v-tab-item>
    <div style="min-height: 420px; max-height: 420px; overflow: auto; background: #424242">
      <transition
        name="fade-transition"
        mode="out-in"
      >
        <v-list
          v-if="content === '' && files.length !== 0"
          :key="0"
        >
          <v-list-tile
            v-for="i in files"
            :key="i"
            v-ripple
            :disabled="loading"
            avatar
            @click="openFile(i)"
          >
            <v-list-tile-avatar>
              <v-icon>
                clear_all
              </v-icon>
            </v-list-tile-avatar>
            <v-list-tile-content>
              <v-list-tile-title>{{ i }}</v-list-tile-title>
            </v-list-tile-content>
            <v-list-tile-action>
              <v-btn
                icon
                color="white"
                flat
                @click.prevent.stop="showFile(i)"
              >
                <v-icon>folder</v-icon>
              </v-btn>
            </v-list-tile-action>
            <v-list-tile-action>
              <v-btn
                icon
                color="red"
                flat
                @click.prevent.stop="removeFile(i)"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </v-list-tile-action>
          </v-list-tile>
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
              <h1>
                Empty
              </h1>
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
              flat
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
import { defineComponent, ref } from '@vue/composition-api'
import { required } from '/@/util/props'

export default defineComponent({
  props: {
    files: required<string[]>(Array),
    getFileContent: required<(file: string) => Promise<string>>(Function),
    removeFile: required<(file: string) => Promise<void>>(Function),
    showFile: required<(file: string) => void>(Function),
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
      loading,
      goBack,
      openFile,
      showedFile,
    }
  },
})
</script>

<style>
</style>
