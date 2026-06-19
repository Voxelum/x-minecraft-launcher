<template>
  <div>
    <v-alert
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-4"
      icon="warning"
    >
      {{ t('setting.customCss.warning') }}
    </v-alert>

    <div
      class="css-editor__textarea-wrapper"
      :class="{ 'css-editor__textarea-wrapper--dragging': isDragging }"
      @dragenter.prevent.stop="isDragging = true"
      @dragover.prevent.stop="isDragging = true"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <textarea
        v-model="draft"
        class="css-editor__textarea"
        :placeholder="t('setting.customCss.editorPlaceholder')"
        spellcheck="false"
        data-testid="custom-css-editor-textarea"
      />
      <div v-if="isDragging" class="css-editor__drop-overlay">
        <v-icon size="28" class="mb-1">upload_file</v-icon>
        {{ t('setting.customCss.dropHint') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import debounce from 'lodash.debounce'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  /** The current CSS content for this scope. */
  css: string
}>()

const emit = defineEmits<{
  (e: 'update:css', value: string): void
}>()

const { t } = useI18n()

const draft = ref(props.css)
const isDragging = ref(false)

function onDragLeave(e: DragEvent) {
  // Ignore leave events fired while moving over the textarea / overlay children.
  const related = e.relatedTarget as Node | null
  if (related && (e.currentTarget as HTMLElement).contains(related)) return
  isDragging.value = false
}

async function onDrop(e: DragEvent) {
  isDragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  const cssFile = files.find((f) => f.name.toLowerCase().endsWith('.css') || f.type === 'text/css')
  if (!cssFile) return
  try {
    // Loading a file replaces the document, mirroring “open this CSS file”.
    draft.value = await cssFile.text()
  } catch {
    // ignore unreadable file
  }
}

// Keep the editor in sync when the CSS changes elsewhere (agent, theme import,
// scope switch) without clobbering what the user is currently typing.
watch(() => props.css, (v) => {
  if (v !== draft.value) {
    draft.value = v
  }
})

const saveDraft = debounce((content: string) => {
  emit('update:css', content)
}, 600)

watch(draft, (v) => {
  if (v !== props.css) {
    saveDraft(v)
  }
})
</script>

<style scoped>
.css-editor__textarea-wrapper {
  position: relative;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.css-editor__textarea-wrapper--dragging {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 1px rgb(var(--v-theme-primary));
}

.css-editor__drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
  font-size: 0.9rem;
  font-weight: 500;
  pointer-events: none;
}

.css-editor__textarea {
  width: 100%;
  min-height: 240px;
  max-height: 480px;
  resize: vertical;
  padding: 12px;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.85rem;
  line-height: 1.6;
  background: rgba(0, 0, 0, 0.2);
  color: inherit;
  border: none;
  outline: none;
  tab-size: 2;
}

.css-editor__textarea::placeholder {
  opacity: 0.4;
}

.css-editor__textarea:focus {
  background: rgba(0, 0, 0, 0.3);
}
</style>
