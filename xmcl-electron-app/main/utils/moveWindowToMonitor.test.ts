import { describe, expect, it, vi } from 'vitest'
import { isMonitorSelectionSupported, moveWindowToMonitor } from './moveWindowToMonitor'

const moveWindowsWindow = vi.fn()
const moveMacWindow = vi.fn()
const moveX11Window = vi.fn()
const { dipToScreenRect } = vi.hoisted(() => ({
  dipToScreenRect: vi.fn((_window: null, bounds: { x: number; y: number; width: number; height: number }) => ({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width * 1.25,
    height: bounds.height * 1.25,
  })),
}))

vi.mock('./gameWindow/windows', () => ({ moveWindowsWindow }))
vi.mock('./gameWindow/macos', () => ({ moveMacWindow }))
vi.mock('./gameWindow/x11', () => ({ moveX11Window }))
vi.mock('electron', () => ({ screen: { dipToScreenRect } }))

describe('moveWindowToMonitor', () => {
  const bounds = { x: -1920, y: 120, width: 1920, height: 1080 }

  it('converts Windows DIP bounds to physical screen coordinates', async () => {
    await moveWindowToMonitor(42, bounds, 'win32')

    expect(dipToScreenRect).toHaveBeenCalledWith(null, bounds)
    expect(moveWindowsWindow).toHaveBeenCalledWith(42, {
      x: -1920,
      y: 120,
      width: 2400,
      height: 1350,
    })
  })

  it('uses macOS bounds without Windows DPI conversion', async () => {
    await moveWindowToMonitor(42, bounds, 'darwin')

    expect(moveMacWindow).toHaveBeenCalledWith(42, bounds)
  })

  it('uses X11 when DISPLAY is available', async () => {
    vi.stubEnv('DISPLAY', ':0')
    vi.stubEnv('XDG_SESSION_TYPE', 'x11')
    await moveWindowToMonitor(42, bounds, 'linux')
    expect(moveX11Window).toHaveBeenCalledWith(42, bounds)
    vi.unstubAllEnvs()
  })

  it('rejects native Wayland', async () => {
    vi.stubEnv('DISPLAY', ':0')
    vi.stubEnv('XDG_SESSION_TYPE', 'wayland')
    await expect(moveWindowToMonitor(42, bounds, 'linux')).rejects.toThrow('not supported')
    vi.unstubAllEnvs()
  })
})

describe('isMonitorSelectionSupported', () => {
  it('supports Windows, macOS, and Linux with X11', () => {
    expect(isMonitorSelectionSupported('win32')).toBe(true)
    expect(isMonitorSelectionSupported('darwin')).toBe(true)
    expect(isMonitorSelectionSupported('linux', { DISPLAY: ':0', XDG_SESSION_TYPE: 'x11' })).toBe(true)
  })

  it('does not advertise native Wayland', () => {
    expect(isMonitorSelectionSupported('linux', { DISPLAY: ':0', XDG_SESSION_TYPE: 'wayland' })).toBe(false)
  })
})