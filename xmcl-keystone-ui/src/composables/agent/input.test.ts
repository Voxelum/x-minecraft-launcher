import { describe, expect, test } from 'vitest'
import { getAgentEscapeAction, shouldSubmitAgentInput } from './input'

describe('Agent input keyboard policy', () => {
  test('does not submit while an IME composition is active', () => {
    expect(shouldSubmitAgentInput({ key: 'Enter', shiftKey: false, isComposing: true, keyCode: 13 }, false)).toBe(false)
    expect(shouldSubmitAgentInput({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13 }, true)).toBe(false)
    expect(shouldSubmitAgentInput({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 229 }, false)).toBe(false)
    expect(shouldSubmitAgentInput({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13 }, false)).toBe(true)
  })

  test('only submits on Enter without Shift', () => {
    expect(shouldSubmitAgentInput({ key: ' ', shiftKey: false, isComposing: false, keyCode: 32 }, false)).toBe(false)
    expect(shouldSubmitAgentInput({ key: 'a', shiftKey: false, isComposing: false, keyCode: 65 }, false)).toBe(false)
    expect(shouldSubmitAgentInput({ key: 'Enter', shiftKey: true, isComposing: false, keyCode: 13 }, false)).toBe(false)
  })

  test('closes the dialog without aborting an active run', () => {
    expect(getAgentEscapeAction(true)).toBe('close')
    expect(getAgentEscapeAction(false)).toBe('close')
  })
})
