import { getKoffi } from './koffi'
import type { MonitorBounds } from './shared'
import { waitForWindow } from './shared'

const koffi = getKoffi()
const displayType = koffi.pointer(koffi.opaque('XMCLDisplay'))
const clientMessage = koffi.struct('XMCLXClientMessageEvent', {
  type: 'int',
  serial: 'ulong',
  sendEvent: 'int',
  display: displayType,
  window: 'ulong',
  messageType: 'ulong',
  format: 'int',
  data: koffi.array('long', 5),
})

export async function moveX11Window(pid: number, bounds: MonitorBounds) {
  const x11 = koffi.load('libX11.so.6')
  const openDisplay = x11.func('XMCLDisplay *XOpenDisplay(const char *name)')
  const closeDisplay = x11.func('int XCloseDisplay(XMCLDisplay *display)')
  const defaultScreen = x11.func('int XDefaultScreen(XMCLDisplay *display)')
  const rootWindow = x11.func('unsigned long XRootWindow(XMCLDisplay *display, int screen)')
  const internAtom = x11.func('unsigned long XInternAtom(XMCLDisplay *display, const char *name, bool onlyIfExists)')
  const getWindowProperty = x11.func('int XGetWindowProperty(XMCLDisplay *display, unsigned long window, unsigned long property, long offset, long length, bool deleteProperty, unsigned long requestedType, _Out_ unsigned long *actualType, _Out_ int *actualFormat, _Out_ unsigned long *itemCount, _Out_ unsigned long *bytesAfter, _Out_ void **data)')
  const free = x11.func('int XFree(void *data)')
  const moveResizeWindow = x11.func('int XMoveResizeWindow(XMCLDisplay *display, unsigned long window, int x, int y, uint32_t width, uint32_t height)')
  const flush = x11.func('int XFlush(XMCLDisplay *display)')
  const sendEvent = x11.func('int XSendEvent(XMCLDisplay *display, unsigned long window, bool propagate, long eventMask, const XMCLXClientMessageEvent *event)')
  const display = openDisplay(null)
  if (!display) {
    x11.unload()
    throw new Error('Cannot connect to the X11 display')
  }

  const root = rootWindow(display, defaultScreen(display))
  const clientList = internAtom(display, '_NET_CLIENT_LIST_STACKING', false) || internAtom(display, '_NET_CLIENT_LIST', false)
  const pidAtom = internAtom(display, '_NET_WM_PID', false)
  const stateAtom = internAtom(display, '_NET_WM_STATE', false)
  const fullscreenAtom = internAtom(display, '_NET_WM_STATE_FULLSCREEN', false)

  const readProperty = (window: number, property: number) => {
    const actualType = [0]
    const actualFormat = [0]
    const itemCount = [0]
    const bytesAfter = [0]
    const data = [null]
    if (getWindowProperty(display, window, property, 0, 4096, false, 0, actualType, actualFormat, itemCount, bytesAfter, data) !== 0 || !data[0]) return []
    try {
      const values = koffi.decode(data[0], koffi.array('ulong', Number(itemCount[0]))) as Array<number | bigint>
      return values.map(Number)
    } finally {
      free(data[0])
    }
  }

  const setFullscreen = (window: number, enabled: boolean) => {
    sendEvent(display, root, false, 0x180000, {
      type: 33,
      serial: 0,
      sendEvent: 1,
      display,
      window,
      messageType: stateAtom,
      format: 32,
      data: [enabled ? 1 : 0, fullscreenAtom, 0, 1, 0],
    })
    flush(display)
  }

  try {
    const window = await waitForWindow<number>(() => {
      const windows = readProperty(root, clientList)
      return windows.find(candidate => readProperty(candidate, pidAtom)[0] === pid)
    })
    setFullscreen(window, false)
    await new Promise(resolve => setTimeout(resolve, 200))
    moveResizeWindow(display, window, bounds.x, bounds.y, bounds.width, bounds.height)
    flush(display)
    await new Promise(resolve => setTimeout(resolve, 100))
    setFullscreen(window, true)
  } finally {
    closeDisplay(display)
    x11.unload()
  }
}