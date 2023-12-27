export type TimeStyle = 'full' | 'long' | 'medium' | 'short' | undefined
export interface TimeFormatOptions {
  dateStyle?: TimeStyle
  timeStyle?: TimeStyle
}
export function getLocalDateString(s: string | number, options?: TimeFormatOptions) {
  const format = Intl.DateTimeFormat(navigator.language, { dateStyle: options?.dateStyle, timeStyle: options?.timeStyle })
  const d = new Date(s)
  try {
    return format.format(d)
  } catch (e) {
    return d.toLocaleString()
  }
}

export enum TimeUnit {
  Second = 1000,
  Minute = 60 * 1000,
  Hour = 60 * 60 * 1000,
  Day = 24 * 60 * 60 * 1000,
}

export function getHumanizeDuration(millisecond: number): [string, number, TimeUnit] {
  const second = millisecond / TimeUnit.Second
  if (second < 60) {
    return [second.toFixed(2), second, TimeUnit.Second]
  }
  const minute = second / 60
  if (minute < 60) {
    return [minute.toFixed(2), minute, TimeUnit.Minute]
  }
  const hour = minute / 60
  if (hour < 24) {
    return [hour.toFixed(2), hour, TimeUnit.Hour]
  }
  const day = hour / 24
  return [day.toFixed(2), day, TimeUnit.Day]
}

export function getAgoOrDate(d: number | string, format?: TimeFormatOptions) {
  const date = new Date(d).getTime()
  const now = Date.now()
  if (now - date < (TimeUnit.Day * 7)) {
    const [, duration, unit] = getHumanizeDuration(now - date)
    return [Math.floor(duration), unit]
  } else {
    return getLocalDateString(date, format)
  }
}
