import { injection } from '@/util/inject'
import { LaunchException, LaunchExceptions, isException } from '@xmcl/runtime-api'
import { kJavaContext } from './java'

export function useLaunchException(
  title: Ref<string>,
  description: Ref<string>,
  unexpected: Ref<boolean>,
  extraText: Ref<string>,
) {
  const { t } = useI18n()
  const { refresh } = injection(kJavaContext)
  function onException(e: LaunchExceptions) {
    if (e.type === 'launchInvalidJavaPath') {
      title.value = t('launchBlocked.launchInvalidJavaPath.title')
      description.value = t('launchBlocked.launchInvalidJavaPath.description', { javaPath: e.javaPath })
      unexpected.value = true
      extraText.value = ''
      refresh(false)
    } else if (e.type === 'launchJavaNoPermission') {
      title.value = t('launchBlocked.launchJavaNoPermission.title')
      description.value = t('launchBlocked.launchJavaNoPermission.description', { javaPath: e.javaPath })
      unexpected.value = false
      extraText.value = ''
      refresh(false)
    } else if (e.type === 'launchNoProperJava') {
      title.value = t('launchBlocked.launchNoProperJava.title')
      description.value = t('launchBlocked.launchNoProperJava.description', { javaPath: e.javaPath })
      unexpected.value = true
      extraText.value = ''
      refresh(false)
    } else if (e.type === 'launchNoVersionInstalled') {
      title.value = t('launchBlocked.launchNoVersionInstalled.title')
      description.value = t('launchBlocked.launchNoVersionInstalled.description', { version: e.options?.version })
      unexpected.value = true
      extraText.value = ''
    } else if (e.type === 'launchBadVersion') {
      title.value = t('launchBlocked.launchBadVersion.title')
      description.value = t('launchBlocked.launchBadVersion.description', { version: e.version })
      unexpected.value = true
      extraText.value = ''
    } else if (e.type === 'launchSpawnProcessFailed') {
      title.value = t('launchBlocked.launchSpawnProcessFailed.title')
      description.value = t('launchBlocked.launchSpawnProcessFailed.description')
    }
  }
  function onError(err: unknown) {
    if (isException(LaunchException, err)) {
      const e = err.exception
      onException(e)
    } else if (typeof err === 'object') {
      title.value = t('launchBlocked.launchGeneralException.title')
      description.value = t('launchBlocked.launchGeneralException.description')
      unexpected.value = true
      const e = err as Error
      if (typeof e.stack === 'string') {
        extraText.value += e.stack
      } else if (typeof e.message === 'string') {
        extraText.value = e.message
      } else if (typeof e.toString === 'function') {
        extraText.value = e.toString()
      } else {
        extraText.value = ''
      }
    }
  }

  return {
    onError,
    onException,
  }
}
