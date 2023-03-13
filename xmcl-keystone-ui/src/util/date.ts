export function getLocalDateString(s: string | number) {
  return new Date(s).toLocaleDateString()
}
export function getLocalTimeString(s: string | number) {
  return new Date(s).toLocaleString()
}

export enum TimeUnit {
  Second = 1000,
  Minute = 60 * 1000,
  Hour = 60 * 60 * 1000,
  Day = 24 * 60 * 60 * 1000,
}

export function getHumanizeDuration(millisecond: number): [number, TimeUnit] {
  if (millisecond < TimeUnit.Minute) {
    return [millisecond / TimeUnit.Second, TimeUnit.Second]
  } else if (millisecond < TimeUnit.Hour) {
    return [millisecond / TimeUnit.Minute, TimeUnit.Minute]
  } else if (millisecond < TimeUnit.Day) {
    return [millisecond / TimeUnit.Hour, TimeUnit.Hour]
  } else {
    return [millisecond / TimeUnit.Day, TimeUnit.Day]
  }
}

export function getAgoOrDate(date: number) {
  const now = Date.now()
  if (now - date < (TimeUnit.Day * 7)) {
    const [duration, unit] = getHumanizeDuration(now - date)
    return [Math.floor(duration), unit]
  } else {
    return getLocalDateString(date)
  }
}
