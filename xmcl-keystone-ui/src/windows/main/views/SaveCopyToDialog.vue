<template>
  <v-dialog
    :value="value"
    width="500"
    persistent
  >
    <v-card>
      <v-card-title
        class="headline"
        primary-title
      >
        {{ t('save.copy.title') }}
      </v-card-title>
      <v-card-text>
        {{ t('save.copy.description') }}
      </v-card-text>

      <v-card-text>
        <v-checkbox
          v-for="(p, index) of instances"
          :key="index"
          v-model="selected[index]"
          hide-details
          :label="p"
        />
      </v-card-text>

      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn
          color="error"
          text
          @click="cancel"
        >
          {{ t('save.copy.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          text
          @click="operate"
        >
          {{ t('save.copy.confirm') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script lang=ts setup>

const props = defineProps<{
  cancel(): void
  operate(instances: string[]): void
  value: string
  instances:string[]
}>()

const { t } = useI18n()
const selected = ref(new Array<string>(props.instances.length))
</script>

<i18n locale="en" lang="yaml">
save:
  copy:
    name: Copy Save
    cancel: Cancel Copy
    confirm: Start Copy
    description: Please select destination profile(s) you want the save to go.
    title: Copy Save to Other Profile
</i18n>

<i18n locale="zh-CN" lang="yaml">
save:
  copy:
    name: 复制存档
    cancel: 取消复制
    confirm: 开始复制
    description: 请勾选你想让存档复制到的启动配置（目标启动配置）
    title: 复制存档到其他启动配置
</i18n>

<i18n locale="ru" lang="yaml">
save:
  copy:
    name: Копировать сохранение
    cancel: Отменить копирование
    confirm: Начать копирование
    description: Выберите целевые профили, которые вы хотите сохранить.
    title: Копировать сохранение в другой профиль
</i18n>
