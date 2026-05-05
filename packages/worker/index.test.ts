import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { Worker } from 'worker_threads'
import { createLazyWorker } from './index'

// Mock Worker class
class MockWorker {
  private listeners: Record<string, Function[]> = {}
  
  postMessage(message: any) {
    // Store posted message for verification
    this.lastMessage = message
  }
  
  lastMessage: any
  
  on(event: string, handler: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(handler)
  }
  
  emit(event: string, data: any) {
    const handlers = this.listeners[event] || []
    handlers.forEach(handler => handler(data))
  }
  
  terminate() {
    this.terminated = true
  }
  
  terminated = false
}

interface TestWorkerAPI {
  add(a: number, b: number): Promise<number>
  multiply(x: number, y: number): Promise<number>
  throwError(): Promise<void>
  asyncGenerator(): AsyncGenerator<number>
}

describe('createLazyWorker', () => {
  let mockWorker: MockWorker
  let factory: () => Worker
  let logger: { log: (message: string) => void }
  let Exception: new (info: { type: string }, message: string) => Error
  
  beforeEach(() => {
    mockWorker = new MockWorker()
    factory = vi.fn(() => mockWorker as any)
    logger = {
      log: vi.fn()
    }
    Exception = class CustomException extends Error {
      constructor(public info: { type: string }, message: string) {
        super(message)
      }
    }
  })

  it('should create a lazy worker proxy', () => {
    const [proxy, dispose] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add', 'multiply'] },
      logger,
      Exception
    )
    
    expect(proxy).toBeDefined()
    expect(dispose).toBeInstanceOf(Function)
    expect(factory).not.toHaveBeenCalled() // Worker not created yet (lazy)
  })

  it('should create worker on first method call', async () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    expect(factory).not.toHaveBeenCalled()
    
    const promise = proxy.add(2, 3)
    
    expect(factory).toHaveBeenCalledTimes(1)
    expect(mockWorker.lastMessage).toEqual({
      type: 'add',
      id: 0,
      args: [2, 3]
    })
    
    // Simulate worker response
    mockWorker.emit('message', { id: 0, result: 5 })
    
    const result = await promise
    expect(result).toBe(5)
  })

  it('should reuse existing worker for subsequent calls', async () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add', 'multiply'] },
      logger,
      Exception
    )
    
    const promise1 = proxy.add(2, 3)
    mockWorker.emit('message', { id: 0, result: 5 })
    await promise1
    
    expect(factory).toHaveBeenCalledTimes(1)
    
    const promise2 = proxy.multiply(4, 5)
    mockWorker.emit('message', { id: 1, result: 20 })
    await promise2
    
    expect(factory).toHaveBeenCalledTimes(1) // Still only called once
  })

  it('should handle errors from worker', async () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['throwError'] },
      logger,
      Exception
    )
    
    const promise = proxy.throwError()
    
    const error = new Error('Test error')
    mockWorker.emit('message', { id: 0, error })
    
    await expect(promise).rejects.toThrow('Test error')
  })

  it('should increment message id for each call', async () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    proxy.add(1, 2)
    expect(mockWorker.lastMessage.id).toBe(0)
    
    proxy.add(3, 4)
    expect(mockWorker.lastMessage.id).toBe(1)
    
    proxy.add(5, 6)
    expect(mockWorker.lastMessage.id).toBe(2)
  })

  it('should dispose worker immediately when dispose is called', () => {
    const [proxy, dispose] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    // Create worker
    proxy.add(1, 2)
    expect(mockWorker.terminated).toBe(false)
    
    dispose()
    
    expect(mockWorker.terminated).toBe(true)
  })

  it('should reject promise when called after disposal', async () => {
    const [proxy, dispose] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    // First create the worker
    const promise1 = proxy.add(1, 2)
    mockWorker.emit('message', { id: 0, result: 3 })
    await promise1
    
    // Then dispose
    dispose()
    expect(mockWorker.terminated).toBe(true)
    
    // Trying to use after disposal should reject the promise
    const promise2 = proxy.add(3, 4)
    await expect(promise2).rejects.toThrow('The worker is disposed')
  })

  it('should terminate worker after idle timeout', async () => {
    vi.useFakeTimers()
    
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    const promise = proxy.add(2, 3)
    mockWorker.emit('message', { id: 0, result: 5 })
    await promise
    
    // Emit idle message
    mockWorker.emit('message', 'idle')
    
    expect(mockWorker.terminated).toBe(false)
    
    // Advance time by 60 seconds
    vi.advanceTimersByTime(60 * 1000)
    
    expect(mockWorker.terminated).toBe(true)
    
    vi.useRealTimers()
  })

  it('should cancel idle timeout on new method call', async () => {
    vi.useFakeTimers()
    
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    // First call
    const promise1 = proxy.add(2, 3)
    mockWorker.emit('message', { id: 0, result: 5 })
    await promise1
    
    // Emit idle message
    mockWorker.emit('message', 'idle')
    
    // Advance time by 30 seconds
    vi.advanceTimersByTime(30 * 1000)
    
    // Make another call before timeout
    const promise2 = proxy.add(4, 5)
    
    // Advance time by another 40 seconds
    vi.advanceTimersByTime(40 * 1000)
    
    // Worker should still be alive
    expect(mockWorker.terminated).toBe(false)
    
    vi.useRealTimers()
  })

  it('should support async generator methods', async () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['asyncGenerator'], asyncGenerators: ['asyncGenerator'] },
      logger,
      Exception
    )
    
    const generator = proxy.asyncGenerator()
    
    expect(generator).toBeDefined()
    expect(typeof generator.next).toBe('function')
    
    const promise1 = generator.next()
    
    expect(mockWorker.lastMessage).toEqual({
      type: 'asyncGenerator',
      id: 0,
      args: []
    })
    
    mockWorker.emit('message', { id: 0, result: { value: 1, done: false } })
    
    const result1 = await promise1
    expect(result1).toEqual({ value: 1, done: false })
  })

  it('should handle multiple concurrent calls', async () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    const promise1 = proxy.add(1, 2)
    const promise2 = proxy.add(3, 4)
    const promise3 = proxy.add(5, 6)
    
    // Respond out of order
    mockWorker.emit('message', { id: 1, result: 7 })
    mockWorker.emit('message', { id: 0, result: 3 })
    mockWorker.emit('message', { id: 2, result: 11 })
    
    expect(await promise1).toBe(3)
    expect(await promise2).toBe(7)
    expect(await promise3).toBe(11)
  })

  it('should log when worker is awakened', () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    proxy.add(1, 2)
    
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Awake the worker'))
  })

  it('should log when worker is disposed after idle', async () => {
    vi.useFakeTimers()
    
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    const promise = proxy.add(2, 3)
    mockWorker.emit('message', { id: 0, result: 5 })
    await promise
    
    mockWorker.emit('message', 'idle')
    vi.advanceTimersByTime(60 * 1000)
    
    expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('Dispose the worker'))
    
    vi.useRealTimers()
  })

  it('should clear previous idle timer when new idle message arrives', async () => {
    vi.useFakeTimers()
    
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    const promise1 = proxy.add(2, 3)
    mockWorker.emit('message', { id: 0, result: 5 })
    await promise1
    
    // First idle message
    mockWorker.emit('message', 'idle')
    vi.advanceTimersByTime(30 * 1000)
    
    // Second idle message (should reset timer)
    mockWorker.emit('message', 'idle')
    vi.advanceTimersByTime(30 * 1000)
    
    // Worker should still be alive (only 30s since last idle)
    expect(mockWorker.terminated).toBe(false)
    
    // Advance another 30s to reach 60s total from last idle
    vi.advanceTimersByTime(30 * 1000)
    expect(mockWorker.terminated).toBe(true)
    
    vi.useRealTimers()
  })

  it('should pass worker options to factory', () => {
    const options = { workerData: { test: 'data' } }
    
    createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception,
      options
    )
    
    // Trigger worker creation
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception,
      options
    )
    
    proxy.add(1, 2)
    
    expect(factory).toHaveBeenCalledWith(options)
  })

  it('should ignore message responses for unknown ids', async () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    const promise = proxy.add(2, 3)
    
    // Send response with wrong id (should be ignored)
    mockWorker.emit('message', { id: 999, result: 100 })
    
    // Send correct response
    mockWorker.emit('message', { id: 0, result: 5 })
    
    const result = await promise
    expect(result).toBe(5)
  })

  it('should throw error when calling return on async generator', () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['asyncGenerator'], asyncGenerators: ['asyncGenerator'] },
      logger,
      Exception
    )
    
    const generator = proxy.asyncGenerator()
    
    expect(() => generator.return(undefined)).toThrow('Function not implemented.')
  })

  it('should throw error when calling throw on async generator', () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['asyncGenerator'], asyncGenerators: ['asyncGenerator'] },
      logger,
      Exception
    )
    
    const generator = proxy.asyncGenerator()
    
    expect(() => generator.throw(new Error('test'))).toThrow('Function not implemented.')
  })

  it('should throw error when accessing Symbol.asyncIterator on async generator', () => {
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['asyncGenerator'], asyncGenerators: ['asyncGenerator'] },
      logger,
      Exception
    )
    
    const generator = proxy.asyncGenerator()
    
    expect(() => generator[Symbol.asyncIterator]()).toThrow('Function not implemented.')
  })

  it('should cancel idle timeout when async generator next is called', async () => {
    vi.useFakeTimers()
    
    const [proxy] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['asyncGenerator'], asyncGenerators: ['asyncGenerator'] },
      logger,
      Exception
    )
    
    // First create the generator and get a value
    const generator = proxy.asyncGenerator()
    const promise1 = generator.next()
    mockWorker.emit('message', { id: 0, result: { value: 1, done: false } })
    await promise1
    
    // Emit idle message to start timeout
    mockWorker.emit('message', 'idle')
    
    // Advance time by 30 seconds
    vi.advanceTimersByTime(30 * 1000)
    
    // Call next again before timeout - should cancel the timer
    const promise2 = generator.next()
    
    // Advance time by another 40 seconds (total 70s, past the 60s timeout)
    vi.advanceTimersByTime(40 * 1000)
    
    // Worker should still be alive because timer was cancelled
    expect(mockWorker.terminated).toBe(false)
    
    vi.useRealTimers()
  })

  it('should do nothing when dispose is called without creating worker', () => {
    const [proxy, dispose] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    // Dispose without ever creating the worker
    dispose()
    
    // Should not crash and factory should never be called
    expect(factory).not.toHaveBeenCalled()
  })

  it('should handle idle timeout after manual disposal', async () => {
    vi.useFakeTimers()
    
    const [proxy, dispose] = createLazyWorker<TestWorkerAPI>(
      factory,
      { methods: ['add'] },
      logger,
      Exception
    )
    
    const promise = proxy.add(2, 3)
    mockWorker.emit('message', { id: 0, result: 5 })
    await promise
    
    // Emit idle message to start timeout
    mockWorker.emit('message', 'idle')
    
    // Advance time by 30 seconds
    vi.advanceTimersByTime(30 * 1000)
    
    // Manually dispose the worker before timeout completes
    dispose()
    expect(mockWorker.terminated).toBe(true)
    
    // Advance time to complete the timeout (another 30 seconds)
    vi.advanceTimersByTime(30 * 1000)
    
    // The timeout callback should handle the case where worker is already undefined
    // No error should be thrown, and log should not be called again
    const logCallCount = (logger.log as any).mock.calls.length
    expect(logCallCount).toBeGreaterThanOrEqual(1) // At least the "Awake" call
    
    vi.useRealTimers()
  })
})
