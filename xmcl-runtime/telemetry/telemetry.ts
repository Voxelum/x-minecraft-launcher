export const APP_INSIGHT_KEY = 'InstrumentationKey=294f3664-8208-4963-a2b0-62405ff9d48e;IngestionEndpoint=https://eastasia-0.in.applicationinsights.azure.com/;LiveEndpoint=https://eastasia.livediagnostics.monitor.azure.com/'

class _StackFrame {
  // regex to match stack frames from ie/chrome/ff
  // methodName=$2, fileName=$4, lineNo=$5, column=$6
  public static regex = /^(\s+at)?(.*?)(@|\s\(|\s)([^(\n]+):(\d+):(\d+)(\)?)$/
  public static baseSize = 58 // '{"method":"","level":,"assembly":"","fileName":"","line":}'.length
  public sizeInBytes = 0
  public level: number
  public method: string
  public assembly: string
  public fileName = ''
  public line = 0

  constructor(frame: string, level: number) {
    this.level = level
    this.method = '<no_method>'
    this.assembly = frame.trim()
    const matches = frame.match(_StackFrame.regex)
    if (matches && matches.length >= 5) {
      this.method = (matches[2])?.trim() || this.method
      this.fileName = (matches[4])?.trim() || '<no_filename>'
      this.line = parseInt(matches[5]) || 0
    }

    this.sizeInBytes += this.method.length
    this.sizeInBytes += this.fileName.length
    this.sizeInBytes += this.assembly.length

    // todo: these might need to be removed depending on how the back-end settles on their size calculation
    this.sizeInBytes += _StackFrame.baseSize
    this.sizeInBytes += this.level.toString().length
    this.sizeInBytes += this.line.toString().length
  }
}

export const parseStack = (stack: any) => {
  let parsedStack: _StackFrame[] | undefined
  if (typeof stack === 'string') {
    const frames = stack.split('\n')
    parsedStack = []
    let level = 0

    let totalSizeInBytes = 0
    for (let i = 0; i <= frames.length; i++) {
      const frame = frames[i]
      if (_StackFrame.regex.test(frame)) {
        const parsedFrame = new _StackFrame(frames[i], level++)
        totalSizeInBytes += parsedFrame.sizeInBytes
        parsedStack.push(parsedFrame)
      }
    }

    // DP Constraint - exception parsed stack must be < 32KB
    // remove frames from the middle to meet the threshold
    const exceptionParsedStackThreshold = 32 * 1024
    if (totalSizeInBytes > exceptionParsedStackThreshold) {
      let left = 0
      let right = parsedStack.length - 1
      let size = 0
      let acceptedLeft = left
      let acceptedRight = right

      while (left < right) {
        // check size
        const lSize = parsedStack[left].sizeInBytes
        const rSize = parsedStack[right].sizeInBytes
        size += lSize + rSize

        if (size > exceptionParsedStackThreshold) {
          // remove extra frames from the middle
          const howMany = acceptedRight - acceptedLeft + 1
          parsedStack.splice(acceptedLeft, howMany)
          break
        }

        // update pointers
        acceptedLeft = left
        acceptedRight = right

        left++
        right--
      }
    }
  }

  return parsedStack
}
