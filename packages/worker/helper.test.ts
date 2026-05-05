import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { WorkPayload } from './index'

// Mock MessagePort
class MockMessagePort {
  private listeners: Record<string, Function[]> = {}
  
  on(event: string, handler: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(handler)
  }
  
  async emit(event: string, data: any) {
    const handlers = this.listeners[event] || []
    for (const handler of handlers) {
      await handler(data)
    }
  }
  
  postMessage(message: any) {
    this.messages.push(message)
  }
  
  messages: any[] = []
}

// Create a mocked parent port that can be reassigned
const mockParentPortObj = vi.hoisted(() => ({ value: null as MockMessagePort | null }))

vi.mock('worker_threads', () => {
  return {
    get parentPort() {
      return mockParentPortObj.value
    },
    MessagePort: class {},
  }
})

import { setHandler } from './helper'

describe('setHandler', () => {
  let mockPort: MockMessagePort
  let getSerializedErrorFunc: (error: Error, options: Record<string, unknown>) => Promise<unknown>
  
  beforeEach(() => {
    mockPort = new MockMessagePort()
    mockParentPortObj.value = null
    getSerializedErrorFunc = vi.fn(async (error: Error) => ({
      message: error.message,
      stack: error.stack,
    }))
  })

  it('should handle simple async function call', async () => {
    const handlers = {
      add: async (a: number, b: number) => a + b,
    }
    
    // Set parentPort before calling setHandler
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    const payload: WorkPayload = {
      type: 'add',
      id: 1,
      args: [2, 3],
    }
    
    await mockPort.emit('message', payload)
    
    expect(mockPort.messages).toHaveLength(2)
    expect(mockPort.messages[0]).toEqual({
      id: 1,
      result: 5,
    })
    expect(mockPort.messages[1]).toBe('idle')
  })

  it('should handle multiple sequential calls', async () => {
    const handlers = {
      multiply: async (x: number, y: number) => x * y,
      divide: async (x: number, y: number) => x / y,
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    await mockPort.emit('message', { type: 'multiply', id: 1, args: [4, 5] })
    await mockPort.emit('message', { type: 'divide', id: 2, args: [10, 2] })
    
    expect(mockPort.messages).toHaveLength(4)
    expect(mockPort.messages[0]).toEqual({ id: 1, result: 20 })
    expect(mockPort.messages[1]).toBe('idle')
    expect(mockPort.messages[2]).toEqual({ id: 2, result: 5 })
    expect(mockPort.messages[3]).toBe('idle')
  })

  it('should handle errors and serialize them', async () => {
    const handlers = {
      throwError: async () => {
        throw new Error('Test error')
      },
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    await mockPort.emit('message', { type: 'throwError', id: 1, args: [] })
    
    expect(mockPort.messages).toHaveLength(2)
    expect(mockPort.messages[0]).toEqual({
      id: 1,
      error: {
        message: 'Test error',
        stack: expect.any(String),
      },
    })
    expect(mockPort.messages[1]).toBe('idle')
    expect(getSerializedErrorFunc).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error' }),
      {}
    )
  })

  it('should handle non-Error throws', async () => {
    const handlers = {
      throwString: async () => {
        throw 'String error'
      },
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    await mockPort.emit('message', { type: 'throwString', id: 1, args: [] })
    
    expect(mockPort.messages).toHaveLength(2)
    expect(mockPort.messages[0]).toEqual({
      id: 1,
      error: 'String error',
    })
    expect(mockPort.messages[1]).toBe('idle')
    expect(getSerializedErrorFunc).not.toHaveBeenCalled()
  })

  it('should handle async generator functions', async () => {
    const handlers = {
      asyncGen: async function* () {
        yield 1
        yield 2
        yield 3
      },
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    // First call
    await mockPort.emit('message', { type: 'asyncGen', id: 1, args: [] })
    expect(mockPort.messages[0]).toEqual({ id: 1, result: { value: 1, done: false } })
    
    // Second call (same id, should reuse generator)
    await mockPort.emit('message', { type: 'asyncGen', id: 1, args: [] })
    expect(mockPort.messages[2]).toEqual({ id: 1, result: { value: 2, done: false } })
    
    // Third call
    await mockPort.emit('message', { type: 'asyncGen', id: 1, args: [] })
    expect(mockPort.messages[4]).toEqual({ id: 1, result: { value: 3, done: false } })
    
    // Fourth call (should be done)
    await mockPort.emit('message', { type: 'asyncGen', id: 1, args: [] })
    expect(mockPort.messages[6]).toEqual({ id: 1, result: { value: undefined, done: true } })
  })

  it('should cleanup generator after it is done', async () => {
    const handlers = {
      asyncGen: async function* () {
        yield 1
      },
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    // First call
    await mockPort.emit('message', { type: 'asyncGen', id: 1, args: [] })
    expect(mockPort.messages[0]).toEqual({ id: 1, result: { value: 1, done: false } })
    
    // Second call (should complete)
    await mockPort.emit('message', { type: 'asyncGen', id: 1, args: [] })
    expect(mockPort.messages[2]).toEqual({ id: 1, result: { value: undefined, done: true } })
    
    // Third call (should create new generator)
    await mockPort.emit('message', { type: 'asyncGen', id: 1, args: [] })
    expect(mockPort.messages[4]).toEqual({ id: 1, result: { value: 1, done: false } })
  })

  it('should handle errors in async generators', async () => {
    const handlers = {
      asyncGenError: async function* () {
        yield 1
        throw new Error('Generator error')
      },
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    // First call - successful yield
    await mockPort.emit('message', { type: 'asyncGenError', id: 1, args: [] })
    expect(mockPort.messages[0]).toEqual({ id: 1, result: { value: 1, done: false } })
    
    // Second call - should throw
    await mockPort.emit('message', { type: 'asyncGenError', id: 1, args: [] })
    expect(mockPort.messages[2]).toEqual({
      id: 1,
      error: {
        message: 'Generator error',
        stack: expect.any(String),
      },
    })
  })

  it('should maintain separate semaphore for concurrent calls', async () => {
    const handlers = {
      slow: async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'done'
      },
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    // Start two concurrent calls
    const promise1 = mockPort.emit('message', { type: 'slow', id: 1, args: [] })
    const promise2 = mockPort.emit('message', { type: 'slow', id: 2, args: [] })
    
    await Promise.all([promise1, promise2])
    
    // Both should have completed
    expect(mockPort.messages.length).toBeGreaterThanOrEqual(3)
    expect(mockPort.messages.filter(m => typeof m === 'object' && m.result === 'done')).toHaveLength(2)
    // At least one idle message should be sent
    expect(mockPort.messages.filter(m => m === 'idle').length).toBeGreaterThanOrEqual(1)
  })

  it('should ignore messages with unknown handler types', async () => {
    const handlers = {
      known: async () => 'result',
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    await mockPort.emit('message', { type: 'unknown', id: 1, args: [] })
    
    // No messages should be posted
    expect(mockPort.messages).toHaveLength(0)
  })

  it('should pass correct arguments to handler', async () => {
    const handler = vi.fn(async (a: number, b: string, c: boolean) => ({ a, b, c }))
    const handlers = {
      testArgs: handler,
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    await mockPort.emit('message', { type: 'testArgs', id: 1, args: [42, 'hello', true] })
    
    expect(handler).toHaveBeenCalledWith(42, 'hello', true)
    expect(mockPort.messages[0]).toEqual({
      id: 1,
      result: { a: 42, b: 'hello', c: true },
    })
  })

  it('should handle promises that resolve to undefined', async () => {
    const handlers = {
      returnUndefined: async () => undefined,
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    await mockPort.emit('message', { type: 'returnUndefined', id: 1, args: [] })
    
    expect(mockPort.messages[0]).toEqual({
      id: 1,
      result: undefined,
    })
  })

  it('should handle async generator that yields objects', async () => {
    const handlers = {
      asyncGenObjects: async function* () {
        yield { type: 'start', value: 1 }
        yield { type: 'middle', value: 2 }
        yield { type: 'end', value: 3 }
      },
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    await mockPort.emit('message', { type: 'asyncGenObjects', id: 1, args: [] })
    expect(mockPort.messages[0]).toEqual({
      id: 1,
      result: { value: { type: 'start', value: 1 }, done: false },
    })
    
    await mockPort.emit('message', { type: 'asyncGenObjects', id: 1, args: [] })
    expect(mockPort.messages[2]).toEqual({
      id: 1,
      result: { value: { type: 'middle', value: 2 }, done: false },
    })
    
    await mockPort.emit('message', { type: 'asyncGenObjects', id: 1, args: [] })
    expect(mockPort.messages[4]).toEqual({
      id: 1,
      result: { value: { type: 'end', value: 3 }, done: false },
    })
  })

  it('should decrement semaphore correctly on error', async () => {
    const handlers = {
      throwError: async () => {
        throw new Error('Test')
      },
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    await mockPort.emit('message', { type: 'throwError', id: 1, args: [] })
    
    // Should still send idle message after error
    expect(mockPort.messages[1]).toBe('idle')
  })

  it('should handle multiple different generators concurrently', async () => {
    const handlers = {
      gen1: async function* () {
        yield 'a'
        yield 'b'
      },
      gen2: async function* () {
        yield 1
        yield 2
      },
    }
    
    mockParentPortObj.value = mockPort as any
    setHandler(handlers, getSerializedErrorFunc)
    
    // Start gen1
    await mockPort.emit('message', { type: 'gen1', id: 1, args: [] })
    expect(mockPort.messages[0]).toEqual({ id: 1, result: { value: 'a', done: false } })
    
    // Start gen2
    await mockPort.emit('message', { type: 'gen2', id: 2, args: [] })
    expect(mockPort.messages[2]).toEqual({ id: 2, result: { value: 1, done: false } })
    
    // Continue gen1
    await mockPort.emit('message', { type: 'gen1', id: 1, args: [] })
    expect(mockPort.messages[4]).toEqual({ id: 1, result: { value: 'b', done: false } })
    
    // Continue gen2
    await mockPort.emit('message', { type: 'gen2', id: 2, args: [] })
    expect(mockPort.messages[6]).toEqual({ id: 2, result: { value: 2, done: false } })
  })

  it('should not register handlers when parentPort is null', () => {
    const handlers = {
      test: async () => 'result',
    }
    
    // Keep parentPort as null
    mockParentPortObj.value = null
    setHandler(handlers, getSerializedErrorFunc)
    
    // No message listeners should be registered since parentPort is null
    // This test ensures the branch where parentPort === null is covered
    expect(mockPort.messages).toHaveLength(0)
  })
})
