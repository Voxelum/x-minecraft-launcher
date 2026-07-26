import type { MonitorInfo } from '@xmcl/runtime-api'

export function useMonitorItems() {
  const { t } = useI18n()
  const monitors = ref<MonitorInfo[]>([])

  onMounted(() => {
    windowController.getMonitors().then((value) => {
      monitors.value = value
    }).catch(() => {
      monitors.value = []
    })
  })

  return computed(() => [
    {
      title: t('instance.monitorDefault'),
      value: '',
    },
    ...monitors.value.map((monitor, index) => ({
      title: `${t('instance.monitorNumber', { number: index + 1 })}: ${monitor.label ? `${monitor.label} - ` : ''}${monitor.width} x ${monitor.height}${monitor.primary ? ` (${t('instance.monitorPrimary')})` : ''}`,
      value: monitor.id,
    })),
  ])
}