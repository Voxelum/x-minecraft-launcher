import { describe, expect, test } from 'vitest'
import { getLocalX11Socket, parseSystemdUserEnvironment, resolveLinuxDisplayEnvironment } from './linuxDisplay'

describe('linux display environment', () => {
  test('parses systemd user environment values containing equals signs', () => {
    expect(parseSystemdUserEnvironment('DISPLAY=:1\nTOKEN=a=b\ninvalid line')).toEqual({
      DISPLAY: ':1',
      TOKEN: 'a=b',
    })
  })

  test('resolves local X11 display sockets', () => {
    expect(getLocalX11Socket(':1')).toBe('/tmp/.X11-unix/X1')
    expect(getLocalX11Socket(':1.0')).toBe('/tmp/.X11-unix/X1')
    expect(getLocalX11Socket('localhost:10.0')).toBeUndefined()
  })

  test('preserves an existing display environment', () => {
    const env = { DISPLAY: ':0' }
    expect(resolveLinuxDisplayEnvironment(env, {}, {
      xwaylandAvailable: false,
      x11SocketAvailable: false,
    })).toEqual({ type: 'ready', env, recovered: false })
  })

  test('recovers a verified display and Xauthority from the user session', () => {
    const result = resolveLinuxDisplayEnvironment(
      { WAYLAND_DISPLAY: 'wayland-1' },
      { DISPLAY: ':1', XAUTHORITY: '/run/user/1000/xauth', XDG_RUNTIME_DIR: '/run/user/1000' },
      { xwaylandAvailable: true, x11SocketAvailable: true },
      path => path === '/tmp/.X11-unix/X1' || path === '/run/user/1000/xauth',
    )

    expect(result).toEqual({
      type: 'ready',
      recovered: true,
      env: {
        DISPLAY: ':1',
        WAYLAND_DISPLAY: 'wayland-1',
        XAUTHORITY: '/run/user/1000/xauth',
        XDG_RUNTIME_DIR: '/run/user/1000',
      },
    })
  })

  test('does not trust a display whose socket is missing', () => {
    expect(resolveLinuxDisplayEnvironment(
      { WAYLAND_DISPLAY: 'wayland-1' },
      { DISPLAY: ':1' },
      { xwaylandAvailable: true, x11SocketAvailable: false },
      () => false,
    )).toEqual({ type: 'unavailable', reason: 'xwayland-not-running' })
  })

  test('does not report XWayland missing when an X11 socket is running', () => {
    expect(resolveLinuxDisplayEnvironment(
      { WAYLAND_DISPLAY: 'wayland-1' },
      {},
      { xwaylandAvailable: false, x11SocketAvailable: true },
    )).toEqual({ type: 'unavailable', reason: 'environment-missing' })
  })

  test('reports a sandbox failure before guessing a display', () => {
    expect(resolveLinuxDisplayEnvironment(
      { WAYLAND_DISPLAY: 'wayland-1', FLATPAK_ID: 'org.xmcl.launcher' },
      {},
      { xwaylandAvailable: false, x11SocketAvailable: false },
    )).toEqual({ type: 'unavailable', reason: 'sandbox-denied' })
  })
})