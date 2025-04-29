import { InvalidDirectoryErrorCode } from '@xmcl/runtime-api';

export function useGetDataDirErrorText() {
  const { t } = useI18n()
  function getDataRootErrors(code: InvalidDirectoryErrorCode) {
    if (!code) {
      return ''
    }
    if (code === 'invalidchar') {
      return t('setup.error.invalidChar')
    }
    if (code === 'bad') {
      return t('setup.error.badDataRoot')
    }
    if (code === 'nondictionary') {
      return t('setup.error.nonDictionary')
    }
    if (code === 'noperm') {
      return t('setup.error.noPermission')
    }
    return t('setup.error.exists')
  }
  return getDataRootErrors
}