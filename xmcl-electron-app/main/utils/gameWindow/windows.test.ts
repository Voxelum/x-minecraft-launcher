import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const enumWindows = vi.fn((callback: (window: bigint) => boolean) => callback(1n))
  const getWindowThreadProcessId = vi.fn((_window: bigint, pid: number[]) => { pid[0] = 42 })
  const isWindowVisible = vi.fn(() => true)
  const setWindowPos = vi.fn(() => true)
  const func = vi.fn((_convention: string, name: string) => ({
    EnumWindows: enumWindows,
    GetWindowThreadProcessId: getWindowThreadProcessId,
    IsWindowVisible: isWindowVisible,
    SetWindowPos: setWindowPos,
  })[name])
  const load = vi.fn(() => ({ func }))
  const pointer = vi.fn((type: unknown) => ({ type }))
  const koffi = {
    load,
    opaque: vi.fn(() => ({})),
    pointer,
    proto: vi.fn(() => ({})),
    out: vi.fn((type: unknown) => type),
  }
  return { enumWindows, getWindowThreadProcessId, isWindowVisible, koffi, load, pointer, setWindowPos }
})

vi.mock('./koffi', () => ({ getKoffi: () => mocks.koffi }))

import { moveWindowsWindow } from './windows'

describe('moveWindowsWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reuses native types and bindings across repeated moves', async () => {
    const bounds = { x: -1920, y: 120, width: 1920, height: 1080 }

    await moveWindowsWindow(42, bounds)
    await moveWindowsWindow(42, bounds)

    expect(mocks.load).not.toHaveBeenCalled()
    expect(mocks.pointer).not.toHaveBeenCalled()
    expect(mocks.enumWindows).toHaveBeenCalledTimes(2)
    expect(mocks.setWindowPos).toHaveBeenCalledTimes(2)
  })
})