import { describe, expect, test } from 'vitest'
import { getAgentEscapeAction, shouldSubmitAgentInput } from './input'

describe('Agent input keyboard policy', () => {
  test('does not submit while an IME composition is active', () => {
    expect(shouldSubmitAgentInput({ isComposing: true, keyCode: 13 }, false)).toBe(false)
    expect(shouldSubmitAgentInput({ isComposing: false, keyCode: 13 }, true)).toBe(false)
    expect(shouldSubmitAgentInput({ isComposing: false, keyCode: 229 }, false)).toBe(false)
    expect(shouldSubmitAgentInput({ isComposing: false, keyCode: 13 }, false)).toBe(true)
  })

  test('aborts an active run before allowing Escape to close the dialog', () => {
    expect(getAgentEscapeAction(true)).toBe('abort')
    expect(getAgentEscapeAction(false)).toBe('close')
  })
})
