import { describe, expect, it } from 'vitest'
import { getSaveWorldMapLocalPoint } from './saveWorldMapPointer'

describe('SaveWorldMap pointer coordinates', () => {
  it('ignores pointer events after canvas teardown', () => {
    expect(() => getSaveWorldMapLocalPoint(null, { clientX: 10, clientY: 20 })).not.toThrow()
    expect(getSaveWorldMapLocalPoint(null, { clientX: 10, clientY: 20 })).toBeUndefined()
  })

  it('translates pointer coordinates relative to the canvas', () => {
    const element = {
      getBoundingClientRect: () => ({ left: 3, top: 5 } as DOMRect),
    }
    expect(getSaveWorldMapLocalPoint(element, { clientX: 13, clientY: 25 })).toEqual({ x: 10, y: 20 })
  })
})
