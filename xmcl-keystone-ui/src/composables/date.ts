import { TimeFormatOptions, TimeUnit, getAgoOrDate, getHumanizeDuration } from '@/util/date'

export function useDuration() {
  const { t } = useI18n()
  const formatDuration = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return ''
    const [text, value, unit] = getHumanizeDuration(Math.ceil(seconds) * TimeUnit.Second)
    const duration = Number(text).toString()
    switch (unit) {
      case TimeUnit.Second:
        return t('duration.second', { duration }, { plural: value })
      case TimeUnit.Minute:
        return t('duration.minute', { duration }, { plural: value })
      case TimeUnit.Hour:
        return t('duration.hour', { duration }, { plural: value })
      case TimeUnit.Day:
        return t('duration.day', { duration }, { plural: value })
    }
  }
  return { formatDuration }
}

export function useDateString() {
  const { t } = useI18n()
  const getDateString = (date: string | number, format?: TimeFormatOptions | undefined) => {
    const result = getAgoOrDate(date, format)
    if (typeof result === 'string') {
      return result
    }
    const [ago, unit] = result
    switch (unit) {
      case TimeUnit.Hour:
        return t('ago.hour', { duration: ago }, { plural: ago })
      case TimeUnit.Minute:
        return t('ago.minute', { duration: ago }, { plural: ago })
      case TimeUnit.Second:
        return t('ago.second', { duration: ago }, { plural: ago })
      case TimeUnit.Day:
        return t('ago.day', { duration: ago }, { plural: ago })
    }
    return date.toString()
  }
  return {
    getDateString,
  }
}
