
export interface LogRecord {
  tags: string[]
  level: string
  source: string
  date: string
  content: string
  raw: string
}

export function parseTags(tags: string[]) {
  const [date, sourceAndLevel, location] = tags
  const [source, level] = sourceAndLevel.indexOf('/') !== -1 ? sourceAndLevel.split('/') : [sourceAndLevel, 'INFO']
  return {
    date,
    source,
    level,
    location,
  }
}

export function parseLog(log: string): LogRecord {
  const tags = [] as string[]
  let content = ''
  type StateFunc = (c: string, index: number) => boolean
  const normalState: StateFunc = (c, i) => {
    if (c === '[') {
      state = tagState(i)
    } else if (c === ':') {
      content = log.substring(i + 1)
      return true
    }
    return false
  }
  const tagState: (i: number) => StateFunc = (start) => (c, index) => {
    if (c === ']') {
      tags.push(log.substring(start + 1, index))
      state = normalState
    }
    return false
  }
  let state: StateFunc = normalState
  for (let i = 0; i < log.length; i++) {
    const c = log.charAt(i)
    if (state(c, i)) {
      break
    }
  }
  const { source, date, level, location } = parseTags(tags)
  return {
    tags,
    source: location ? `${source}@${location}` : source,
    content,
    date,
    raw: log,
    level: level.toLowerCase(),
  }
}
