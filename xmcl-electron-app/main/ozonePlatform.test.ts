import { describe, expect, it, vi } from 'vitest'
import { getOzonePlatform } from './ozonePlatform'

describe('getOzonePlatform', () => {
  it('falls back to X11 when the advertised Wayland socket is missing', () => {
    const exists = vi.fn(() => false)

    expect(getOzonePlatform({
      DISPLAY: ':0',
      WAYLAND_DISPLAY: 'wayland-0',
      XDG_RUNTIME_DIR: '/run/user/1000',
    }, exists)).toBe('x11')
    expect(exists).toHaveBeenCalledWith('/run/user/1000/wayland-0')
  })

  it('keeps automatic selection when the Wayland socket is available', () => {
    expect(getOzonePlatform({
      DISPLAY: ':0',
      WAYLAND_DISPLAY: 'wayland-0',
      XDG_RUNTIME_DIR: '/run/user/1000',
    }, () => true)).toBe('auto')
  })

  it('keeps automatic selection when X11 is unavailable', () => {
    expect(getOzonePlatform({
      WAYLAND_DISPLAY: 'wayland-0',
      XDG_RUNTIME_DIR: '/run/user/1000',
    }, () => false)).toBe('auto')
  })
})
