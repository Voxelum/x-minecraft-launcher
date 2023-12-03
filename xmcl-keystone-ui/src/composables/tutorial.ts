import { injection } from '@/util/inject'
import { DriveStep } from 'driver.js'
import { InjectionKey, Ref } from 'vue'

export const kTutorial: InjectionKey<ReturnType<typeof useTutorialModel>> = Symbol('tutorial')

export function useTutorialModel() {
  const { t } = useI18n()
  const steps = ref([] as DriveStep[])
  async function start() {
    const { driver } = await import('driver.js')
    await import('driver.js/dist/driver.css')
    await import('../assets/driver.css')
    const driverObj = driver({
      popoverClass: 'driverjs-theme',
      nextBtnText: t('next'),
      animate: true,
      prevBtnText: t('previous'),
      doneBtnText: 'OK!',
      allowClose: true,
      steps: steps.value,
    })
    driverObj.drive()
  }
  return {
    steps,
    start,
  }
}

export function useTutorial(steps: Ref<DriveStep[]>) {
  const tutor = injection(kTutorial)
  onMounted(() => {
    tutor.steps.value = steps.value
    watch(steps, () => {
      tutor.steps.value = steps.value
    })
  })
  onUnmounted(() => {
    tutor.steps.value = []
  })
}
