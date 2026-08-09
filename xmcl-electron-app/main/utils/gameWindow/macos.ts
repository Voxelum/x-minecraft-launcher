import { getKoffi } from './koffi'
import type { MonitorBounds } from './shared'
import { waitForWindow } from './shared'

const koffi = getKoffi()
const point = koffi.struct({ x: 'double', y: 'double' })
const size = koffi.struct({ width: 'double', height: 'double' })

export async function moveMacWindow(pid: number, bounds: MonitorBounds) {
  const applicationServices = koffi.load('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices')
  const coreFoundation = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
  const createApplication = applicationServices.func('void *AXUIElementCreateApplication(int pid)')
  const copyAttribute = applicationServices.func('int AXUIElementCopyAttributeValue(void *element, void *attribute, _Out_ void **value)')
  const setAttribute = applicationServices.func('int AXUIElementSetAttributeValue(void *element, void *attribute, void *value)')
  const createAXValue = applicationServices.func('void *AXValueCreate(int type, const void *value)')
  const createString = coreFoundation.func('void *CFStringCreateWithCString(void *allocator, const char *text, uint32_t encoding)')
  const getArrayCount = coreFoundation.func('long CFArrayGetCount(void *array)')
  const getArrayValue = coreFoundation.func('void *CFArrayGetValueAtIndex(void *array, long index)')
  const getBoolean = coreFoundation.func('bool CFBooleanGetValue(void *boolean)')
  const release = coreFoundation.func('void CFRelease(void *value)')
  const trueValue = koffi.decode(coreFoundation.symbol('kCFBooleanTrue'), 'void *')
  const falseValue = koffi.decode(coreFoundation.symbol('kCFBooleanFalse'), 'void *')
  const utf8 = 0x08000100
  const windowsAttribute = createString(null, 'AXWindows', utf8)
  const fullscreenAttribute = createString(null, 'AXFullScreen', utf8)
  const positionAttribute = createString(null, 'AXPosition', utf8)
  const sizeAttribute = createString(null, 'AXSize', utf8)
  const application = createApplication(pid)

  let windows: bigint | null = null
  try {
    const window = await waitForWindow<bigint>(() => {
      const result = [null]
      if (copyAttribute(application, windowsAttribute, result) !== 0 || !result[0]) return undefined
      if (windows) release(windows)
      windows = result[0]
      return getArrayCount(windows) > 0 ? getArrayValue(windows, 0) : undefined
    })

    const fullscreen = [null]
    const wasFullscreen = copyAttribute(window, fullscreenAttribute, fullscreen) === 0 && !!fullscreen[0] && getBoolean(fullscreen[0])
    if (fullscreen[0]) release(fullscreen[0])
    if (wasFullscreen) {
      setAttribute(window, fullscreenAttribute, falseValue)
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    const positionValue = createAXValue(1, koffi.as({ x: bounds.x, y: bounds.y }, koffi.pointer(point)))
    const sizeValue = createAXValue(2, koffi.as({ width: bounds.width, height: bounds.height }, koffi.pointer(size)))
    try {
      if (setAttribute(window, positionAttribute, positionValue) !== 0 || setAttribute(window, sizeAttribute, sizeValue) !== 0) {
        throw new Error('Cannot move the Minecraft window with macOS Accessibility API')
      }
    } finally {
      release(positionValue)
      release(sizeValue)
    }

    if (wasFullscreen) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setAttribute(window, fullscreenAttribute, trueValue)
    }
  } finally {
    if (windows) release(windows)
    release(application)
    release(windowsAttribute)
    release(fullscreenAttribute)
    release(positionAttribute)
    release(sizeAttribute)
    applicationServices.unload()
    coreFoundation.unload()
  }
}