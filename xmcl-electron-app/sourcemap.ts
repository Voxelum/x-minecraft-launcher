function cloneCallSite(frame: any) {
  const object = {} as any
  Object.getOwnPropertyNames(Object.getPrototypeOf(frame)).forEach(function (name) {
    // eslint-disable-next-line no-useless-call
    object[name] = /^(?:is|get)/.test(name) ? function () { return frame[name].call(frame) } : frame[name]
  })
  object.toString = CallSiteToString
  return object
}

// This is copied almost verbatim from the V8 source code at
// https://code.google.com/p/v8/source/browse/trunk/src/messages.js. The
// implementation of wrapCallSite() used to just forward to the actual source
// code of CallSite.prototype.toString but unfortunately a new release of V8
// did something to the prototype chain and broke the shim. The only fix I
// could find was copy/paste.
function CallSiteToString(this: any) {
  let fileName
  let fileLocation = ''
  if (this.isNative()) {
    fileLocation = 'native'
  } else {
    fileName = this.getScriptNameOrSourceURL()
    if (!fileName && this.isEval()) {
      fileLocation = this.getEvalOrigin()
      fileLocation += ', ' // Expecting source position to follow.
    }

    if (fileName) {
      fileLocation += fileName
    } else {
      // Source code does not originate from a file and is not native, but we
      // can still get the source position inside the source string, e.g. in
      // an eval string.
      fileLocation += '<anonymous>'
    }
    const lineNumber = this.getLineNumber()
    if (lineNumber != null) {
      fileLocation += ':' + lineNumber
      const columnNumber = this.getColumnNumber()
      if (columnNumber) {
        fileLocation += ':' + columnNumber
      }
    }
  }

  let line = ''
  const functionName = this.getFunctionName()
  let addSuffix = true
  const isConstructor = this.isConstructor()
  const isMethodCall = !(this.isToplevel() || isConstructor)
  if (isMethodCall) {
    let typeName = this.getTypeName()
    // Fixes shim to be backward compatable with Node v0 to v4
    if (typeName === '[object Object]') {
      typeName = 'null'
    }
    const methodName = this.getMethodName()
    if (functionName) {
      if (typeName && functionName.indexOf(typeName) !== 0) {
        line += typeName + '.'
      }
      line += functionName
      if (methodName && functionName.indexOf('.' + methodName) !== functionName.length - methodName.length - 1) {
        line += ' [as ' + methodName + ']'
      }
    } else {
      line += typeName + '.' + (methodName || '<anonymous>')
    }
  } else if (isConstructor) {
    line += 'new ' + (functionName || '<anonymous>')
  } else if (functionName) {
    line += functionName
  } else {
    line += fileLocation
    addSuffix = false
  }
  if (addSuffix) {
    line += ' (' + fileLocation + ')'
  }
  return line
}

const buildNumber = process.env.BUILD_NUMBER
const url = `/${buildNumber}`

const wrapCallSite = (frame: any) => {
  if (frame.isNative()) return frame
  frame = cloneCallSite(frame)
  const original = frame.getScriptNameOrSourceURL
  frame.getScriptNameOrSourceURL = function () {
    // substract the path
    let name = original.call(this)
    if (name) {
      name = name.replace(__dirname, url)
      name = name.replace(/\\/g, '/')
    }
    return name
  }
  return frame
}

Error.prepareStackTrace = (error, stack) => {
  const name = error.name || 'Error'
  const message = error.message || ''
  const errorString = name + ': ' + message

  const processedStack = []
  for (let i = stack.length - 1; i >= 0; i--) {
    processedStack.push('\n    at ' + wrapCallSite(stack[i]))
  }
  return errorString + processedStack.reverse().join('')
}
