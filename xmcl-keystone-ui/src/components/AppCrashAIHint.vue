<template>
  <div class="crash-ai-hint flex flex-col gap-4 select-none">
    <div class="flex items-start gap-3">
      <v-avatar size="44" color="primary" variant="tonal">
        <v-icon size="28">smart_toy</v-icon>
      </v-avatar>
      <div class="flex-1 min-w-0">
        <div class="text-base font-medium leading-snug">
          {{ t('askAICrash.description') }}
        </div>
      </div>
    </div>

    <!-- Primary action: let the built-in launcher agent diagnose the crash -->
    <div class="flex flex-col gap-2">
      <v-btn
        color="primary"
        size="large"
        variant="flat"
        prepend-icon="auto_awesome"
        :loading="agentRunning"
        :disabled="agentRunning"
        block
        @click="onAskAgent"
      >
        {{ agentAvailable ? t('askAICrash.askAgent') : t('askAICrash.setupAgent') }}
      </v-btn>
      <div
        v-if="!agentAvailable"
        class="flex items-start gap-1 text-xs opacity-70"
      >
        <v-icon size="14" class="mt-0.5">info</v-icon>
        <span>{{ t('askAICrash.agentNotConfigured') }}</span>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <v-divider class="flex-1" />
      <span class="text-xs opacity-50">{{ t('askAICrash.orExternal') }}</span>
      <v-divider class="flex-1" />
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 text-sm font-medium opacity-80">
        <v-avatar size="20" color="primary" variant="flat">
          <span class="text-xs">1</span>
        </v-avatar>
        <span>{{ t('askAICrash.copyPrompt') }}</span>
      </div>
      <v-btn
        :color="copied ? 'success' : 'primary'"
        :variant="copied ? 'flat' : 'tonal'"
        :prepend-icon="copied ? 'check' : 'content_copy'"
        block
        @click="onCopyPrompt"
      >
        {{ copied ? t('copyClipboard.success') : t('askAICrash.copyPrompt') }}
      </v-btn>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 text-sm font-medium opacity-80">
        <v-avatar size="20" color="primary" variant="flat">
          <span class="text-xs">2</span>
        </v-avatar>
        <span>{{ t('askAICrash.selectPlatform') }}</span>
      </div>
      <div class="ai-platform-list flex flex-col gap-1">
        <a
          v-for="p in platforms"
          :key="p.url"
          :href="p.url"
          target="browser"
          class="ai-platform-item flex items-center gap-3 rounded-md px-3 py-2"
          @click="p.copyRaw ? onCopyRaw() : onCopyPrompt()"
        >
          <PlatformIcon :src="p.icon" :name="p.name" />
          <span class="flex-1 text-sm">{{ p.name }}</span>
          <v-icon size="16" class="opacity-50">open_in_new</v-icon>
        </a>
      </div>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { kAgent } from '@/composables/agent'
import { useAgentChatBus, useAgnesSetupDocUrl } from '@/composables/agentChat'
import { injection } from '@/util/inject'

const { t } = useI18n()
const props = defineProps<{
  getPrompt: (raw?: boolean) => string
  getAgentPrompt: () => string
  useCNAI: boolean
}>()
const emit = defineEmits<{ (e: 'close'): void }>()

const agent = injection(kAgent)
const agentAvailable = agent.available
const agentRunning = agent.running
const chatBus = useAgentChatBus()
const { push } = useRouter()
const setupDocUrl = useAgnesSetupDocUrl()

function onAskAgent() {
  emit('close')
  if (!agentAvailable.value) {
    // Open a single Agnes setup guide when the built-in agent isn't ready.
    window.open(setupDocUrl.value, 'browser')
    push('/setting')
    return
  }
  chatBus.emit('show')
  agent.send(props.getAgentPrompt()).catch((e) => {
    console.error('[crash-agent]', e)
  })
}

const PlatformIcon = defineComponent({
  props: { src: String, name: String },
  setup(p) {
    const failed = ref(false)
    return () => failed.value || !p.src
      ? h('div', {
        class: 'flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-medium',
      }, (p.name || '?').charAt(0).toUpperCase())
      : h('img', {
        src: p.src,
        width: 24,
        height: 24,
        class: 'w-6 h-6 rounded-sm object-contain',
        onError: () => { failed.value = true },
      })
  },
})

const platforms = computed(() => props.useCNAI
  ? [
    { name: 'GLM', url: 'https://chatglm.cn/share/kFiK3rVp', icon: 'https://chatglm.cn/img/icons/favicon.svg', copyRaw: true },
    { name: '豆包', url: 'https://doubao.com/bot/uic8dYCs', icon: 'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/web/logo-icon.png', copyRaw: true },
    { name: 'Deepseek', url: 'https://chat.deepseek.com/', icon: 'https://chat.deepseek.com/favicon.svg', copyRaw: false },
    { name: 'Qwen', url: 'https://www.tongyi.com/', icon: 'https://img.alicdn.com/imgextra/i4/O1CN01EfJVFQ1uZPd7W4W6V_!!6000000006052-2-tps-112-112.png', copyRaw: false },
  ]
  : [
    { name: 'ChatGPT', url: 'https://chat.openai.com', icon: 'https://chat.openai.com/favicon.ico', copyRaw: false },
    { name: 'Gemini', url: 'https://gemini.google.com', icon: 'https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg', copyRaw: false },
    { name: 'Deepseek', url: 'https://chat.deepseek.com/', icon: 'https://chat.deepseek.com/favicon.svg', copyRaw: false },
    { name: 'z.ai', url: 'https://chat.z.ai', icon: 'https://z-cdn.chatglm.cn/z-ai/static/logo.svg', copyRaw: false },
    { name: 'Qwen', url: 'https://chat.qwen.ai/', icon: 'https://img.alicdn.com/imgextra/i4/O1CN01EfJVFQ1uZPd7W4W6V_!!6000000006052-2-tps-112-112.png', copyRaw: false },
  ])

const copied = ref(false)
function onCopyPrompt() {
  windowController.writeClipboard(props.getPrompt())
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function onCopyRaw() {
  windowController.writeClipboard(props.getPrompt(true))
}
</script>

<style scoped>
.ai-platform-item {
  text-decoration: none;
  color: inherit;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
  background: rgba(var(--v-theme-on-surface), 0.02);
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.ai-platform-item:hover {
  background: rgba(var(--v-theme-primary), 0.08);
  border-color: rgba(var(--v-theme-primary), 0.4);
}
</style>
