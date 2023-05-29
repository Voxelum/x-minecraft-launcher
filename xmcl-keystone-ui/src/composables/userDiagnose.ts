import { UserProfile } from '@xmcl/runtime-api'
import { Ref, InjectionKey } from 'vue'
import { useDialog } from './dialog'
import { LoginDialog } from './login'
import { LaunchMenuItem } from './launchButton'

export const kUserDiagnose: InjectionKey<ReturnType<typeof useUserDiagnose>> = Symbol('UserDiagnose')

export function useUserDiagnose(user: Ref<UserProfile | undefined>) {
  const { show } = useDialog(LoginDialog)
  const { t } = useI18n()

  const issue: Ref<LaunchMenuItem | undefined> = computed(() => {
    if (!user.value) {
      return {
        title: t('diagnose.login.title'),
        description: t('diagnose.login.description'),
      }
    }
    return undefined
  })

  function fix() {
    if (issue.value) {
      show()
    }
  }

  return {
    issue,
    fix,
  }
}
