import { getKoffi } from './koffi'
import type { MonitorBounds } from './shared'
import { waitForWindow } from './shared'

const koffi = getKoffi()
const user32 = koffi.load('user32.dll')
const handle = koffi.pointer(koffi.opaque())
const enumWindowsProc = koffi.proto('__stdcall', null, 'bool', [handle, 'intptr_t'])
const enumWindows = user32.func('__stdcall', 'EnumWindows', 'bool', [koffi.pointer(enumWindowsProc), 'intptr_t'])
const getWindowThreadProcessId = user32.func('__stdcall', 'GetWindowThreadProcessId', 'uint32_t', [handle, koffi.out(koffi.pointer('uint32_t'))])
const isWindowVisible = user32.func('__stdcall', 'IsWindowVisible', 'bool', [handle])
const setWindowPos = user32.func('__stdcall', 'SetWindowPos', 'bool', [handle, handle, 'int', 'int', 'int', 'int', 'uint32_t'])

export async function moveWindowsWindow(pid: number, bounds: MonitorBounds) {
  const window = await waitForWindow<bigint>(() => {
    let result: bigint | undefined
    enumWindows((candidate: bigint) => {
      const candidatePid = [0]
      getWindowThreadProcessId(candidate, candidatePid)
      if (candidatePid[0] === pid && isWindowVisible(candidate)) {
        result = candidate
        return false
      }
      return true
    }, 0)
    return result
  })

  const noZOrder = 0x0004
  const noActivate = 0x0010
  const frameChanged = 0x0020
  const showWindow = 0x0040
  if (!setWindowPos(window, null, bounds.x, bounds.y, bounds.width, bounds.height, noZOrder | noActivate | frameChanged | showWindow)) {
    throw new Error('SetWindowPos failed')
  }
}