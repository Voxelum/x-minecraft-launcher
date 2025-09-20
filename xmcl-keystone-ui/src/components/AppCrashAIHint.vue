<template>
  <div class="items-center justify-center flex flex-col gap-6 select-none">
    <v-icon size="60">
      hail
    </v-icon>
    <span class="text-lg">
      {{ t('askAICrash.description') }}
    </span>
    <ol>
      <li>
        {{ t('askAICrash.copyPrompt') }}
        <v-btn color="primary" :outlined="copied" small @click="onCopyPrompt">
          <v-icon left>
            {{ copied ? 'check' : 'smart_toy'}}
          </v-icon>
          {{ t( 'copyClipboard.success' )}}
        </v-btn>
      </li>
      <li>
        {{ t('askAICrash.selectPlatform') }}
        <ul>
          <template v-if="useCNAI">
            <li><a href="https://chatglm.cn/share/kFiK3rVp" @click="onCopyRaw"> <img width="21" src="https://chatglm.cn/img/icons/favicon.svg" > GLM</a></li>
            <li><a href="https://doubao.com/chat"> <img width="21" src="https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/doubao/web/logo-icon.png" > 豆包</a></li>
            <li><a href="https://chat.deepseek.com/"><img src="https://chat.deepseek.com/favicon.svg" >Deepseek</a></li>
            <li><a href="https://www.tongyi.com/"><img src="https://assets.alicdn.com/g/qwenweb/qwen-webui-fe/0.0.209/static/favicon.png" > Qwen </a></li>
          </template>
          <template v-else>
            <li><a href="https://chat.openai.com"> <img width="21" src="https://openai.com/favicon.svg" > ChatGPT</a></li>
            <li><a href="https://gemini.google.com"> <img width="21" src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" > Gemini</a></li>
            <li><a href="https://chat.deepseek.com/"><img width="21" src="https://chat.deepseek.com/favicon.svg" >Deepseek</a></li>
            <li><a href="https://chat.z.ai"> <img width="21" src="https://z-cdn.chatglm.cn/z-ai/static/logo.svg" > z.ai</a></li>
            <li><a href="https://chat.qwen.ai/"> <img width="21" src="https://assets.alicdn.com/g/qwenweb/qwen-webui-fe/0.0.209/static/favicon.png" > Qwen</a></li>
          </template>
        </ul>
      </li>
    </ol>
  </div>
</template>
<script lang="ts" setup>
const { t } = useI18n()
const props = defineProps<{
  getPrompt: (raw?: boolean) => string
  useCNAI: boolean
}>()

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