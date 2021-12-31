export function parseLog (log: string): Log {
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
    return { tags, content, raw: log }
}

export interface Log {
  tags: string[]
  content: string
  raw: string
}
