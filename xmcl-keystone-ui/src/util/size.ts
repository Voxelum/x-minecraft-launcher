export const getExpectedSize = (size: number, unitText = 'B', fix = 2) => {
  size = size / 1024
  let unit = 'K' + unitText
  if (size > 1024) {
    size /= 1024
    unit = 'M' + unitText
  }
  if (size > 1024) {
    size /= 1024
    unit = 'G' + unitText
  }
  return `${Math.abs(size).toFixed(fix)}${unit}`
}

export const formatDuration = (seconds: number, localeOrIsUk: string | boolean = 'en'): string => {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return ''
  const s = Math.ceil(seconds)
  const loc = typeof localeOrIsUk === 'boolean' ? (localeOrIsUk ? 'uk' : 'en') : String(localeOrIsUk || 'en')

  let secUnit = 's'
  let minUnit = 'm'
  let hrUnit = 'h'

  if (loc === 'uk') {
    secUnit = 'с'
    minUnit = 'хв'
    hrUnit = 'год'
  } else if (loc === 'ru' || loc === 'kz') {
    secUnit = 'с'
    minUnit = 'мин'
    hrUnit = 'ч'
  } else if (loc.startsWith('zh')) {
    secUnit = '秒'
    minUnit = '分'
    hrUnit = '时'
  } else if (loc === 'ja-JP' || loc === 'ja') {
    secUnit = '秒'
    minUnit = '分'
    hrUnit = '時間'
  } else if (loc === 'ko') {
    secUnit = '초'
    minUnit = '분'
    hrUnit = '시간'
  } else if (loc === 'de') {
    secUnit = 'Sek'
    minUnit = 'Min'
    hrUnit = 'Std'
  } else if (loc === 'fr') {
    secUnit = 's'
    minUnit = 'min'
    hrUnit = 'h'
  } else if (loc.startsWith('es') || loc.startsWith('pt') || loc.startsWith('it')) {
    secUnit = 's'
    minUnit = 'min'
    hrUnit = 'h'
  } else if (loc === 'pl') {
    secUnit = 's'
    minUnit = 'min'
    hrUnit = 'godz'
  }

  if (s < 60) {
    return `${s}${secUnit}`
  }
  const minutes = Math.floor(s / 60)
  const remainingSeconds = s % 60
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}${minUnit} ${remainingSeconds}${secUnit}` : `${minutes}${minUnit}`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}${hrUnit} ${remainingMinutes}${minUnit}` : `${hours}${hrUnit}`
}
