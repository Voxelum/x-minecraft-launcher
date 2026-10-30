import { expect, it, vi } from 'vitest'
import { runLaunchButtonPreflight } from './launchButtonPreflight'

it('cancels immediately without opening login or waiting for settings flush', async () => {
  const abort = vi.fn()
  const openLogin = vi.fn(() => new Promise<void>(() => {}))
  const flush = vi.fn()
  const result = runLaunchButtonPreflight(true, abort, [openLogin, flush])
  expect(abort).toHaveBeenCalledOnce()
  expect(openLogin).not.toHaveBeenCalled()
  expect(flush).not.toHaveBeenCalled()
  await expect(result).resolves.toBe(false)
})
it('runs all normal launch checks again after cancellation', async () => {
  const abort = vi.fn()
  const login = vi.fn().mockResolvedValue(undefined)
  const flush = vi.fn().mockResolvedValue(undefined)
  await runLaunchButtonPreflight(true, abort, [login, flush])
  await expect(runLaunchButtonPreflight(false, abort, [login, flush])).resolves.toBe(true)
  expect(login).toHaveBeenCalledOnce()
  expect(flush).toHaveBeenCalledOnce()
  expect(abort).toHaveBeenCalledOnce()
})
it('does not authorize a normal launch when login or another check rejects', async () => {
  const abort = vi.fn()
  const login = vi.fn().mockRejectedValue(new Error('login cancelled'))
  const flush = vi.fn()
  await expect(runLaunchButtonPreflight(false, abort, [login, flush])).resolves.toBe(false)
  expect(abort).not.toHaveBeenCalled()
  expect(flush).not.toHaveBeenCalled()
})
