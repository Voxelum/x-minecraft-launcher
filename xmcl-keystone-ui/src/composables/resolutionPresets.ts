export function useResolutionPresets() {
  const { t } = useI18n()
  const resolutionPresets = computed(() => [
    { text: t('java.memoryAuto'), value: { width: undefined, height: undefined } },
    { text: '854×480', value: { width: 854, height: 480 } },
    { text: '1280×720', value: { width: 1280, height: 720 } },
    { text: '1366×768', value: { width: 1366, height: 768 } },
    { text: '1600×900', value: { width: 1600, height: 900 } },
    { text: '1920×1080', value: { width: 1920, height: 1080 } },
    { text: '2560×1440', value: { width: 2560, height: 1440 } },
    { text: '3840×2160', value: { width: 3840, height: 2160 } },
  ])

  return resolutionPresets
}