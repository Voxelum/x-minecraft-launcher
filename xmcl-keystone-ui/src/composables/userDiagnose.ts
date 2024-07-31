import { injection } from '@/util/inject'
import { InjectionKey, Ref } from 'vue'
import { useDialog } from './dialog'
import { LaunchMenuItem } from './launchButton'
import { LoginDialog } from './login'
import { kUserContext } from './user'

export function useUserDiagnose() {
  const { userProfile } = injection(kUserContext)
  const { show } = useDialog(LoginDialog)
  const { t } = useI18n()

  const issue: Ref<LaunchMenuItem | undefined> = computed(() => {
    if (!userProfile.value) {
      return {
        title: t('diagnose.login.title'),
        description: t('diagnose.login.description'),
      }
    }
    return undefined
  })

  function fix() {
    if (userProfile.value) {
      show()
    }
  }

  return {
    issue,
    fix,
  }
}
