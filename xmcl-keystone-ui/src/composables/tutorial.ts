import { injection } from '@/util/inject'
import { DriveStep } from 'driver.js'
import { InjectionKey, Ref } from 'vue'

export const kTutorial: InjectionKey<ReturnType<typeof useTutorialModel>> = Symbol('tutorial')

export function useTutorialModel() {
  const { t } = useI18n()
  const steps = ref([] as DriveStep[])

  function filterValidSteps(inputSteps: DriveStep[]): DriveStep[] {
    return inputSteps.filter((step) => {
      if (!step.element) return true
      if (typeof step.element === 'string') {
        return !!document.querySelector(step.element)
      }
      if (step.element instanceof Element) {
        return true
      }
      return false
    })
  }

  const defaultSteps = computed<DriveStep[]>(() => [
    {
      element: '#my-stuff-button',
      popover: {
        title: t('userAccount.add'),
        description: t('tutorial.userAccountDescription'),
      },
    },
    {
      element: '#create-instance-button',
      popover: {
        title: t('instances.add'),
        description: t('tutorial.instanceAddDescription'),
      },
    },
    {
      element: '#launch-button',
      popover: {
        title: t('launch.launch'),
        description: t('tutorial.launchDescription'),
      },
    },
    {
      element: '#tutor-button',
      popover: {
        title: t('help'),
        description: t('tutorial.helpDescription'),
      },
    },
    {
      element: '#feedback-button',
      popover: {
        title: t('feedback.name'),
        description: t('tutorial.feedbackDescription'),
      },
    },
  ])

  async function start() {
    const rawSteps = steps.value.length > 0 ? steps.value : defaultSteps.value
    let activeSteps = filterValidSteps(rawSteps)
    if (activeSteps.length === 0) {
      activeSteps = filterValidSteps(defaultSteps.value)
      if (activeSteps.length === 0) return
    }

    const { driver } = await import('driver.js')
    await import('driver.js/dist/driver.css')
    await import('../assets/driver.css')
    const driverObj = driver({
      popoverClass: 'driverjs-theme',
      nextBtnText: t('shared.next'),
      prevBtnText: t('shared.previous'),
      doneBtnText: t('tutorial.done'),
      showProgress: true,
      progressText: '{{current}} / {{total}}',
      stagePadding: 8,
      stageRadius: 10,
      popoverOffset: 12,
      animate: true,
      allowClose: true,
      steps: activeSteps,
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
    watch(steps, (newSteps) => {
      tutor.steps.value = newSteps
    })
  })
  onUnmounted(() => {
    tutor.steps.value = []
  })
}

