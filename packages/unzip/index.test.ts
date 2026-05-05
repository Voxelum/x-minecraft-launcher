import { open } from './index'
import { describe, test, expect, vi } from 'vitest'
import { open as yopen, fromBuffer, fromFd } from 'yauzl'

vi.mock('yauzl', () => {
  return {
    open: vi.fn(),
    fromBuffer: vi.fn(),
    fromFd: vi.fn(),
  }
})

describe('Unzip', () => {
  describe('#open', () => {
    test('should call yauzl open', async () => {
      const value = 'test.zip'
      let target: any
      let options: any
      const ret: any = {}
      // @ts-ignore
      vi.mocked(yopen).mockImplementationOnce((_target, _options, cb) => {
        target = _target
        options = _options
        cb(undefined, ret)
      })
      await expect(open(value)).resolves.toEqual(ret)
      expect(target).toEqual('test.zip')
      expect(options).toEqual({ autoClose: false, lazyEntries: true })
    })
    test('should call yauzl fromBuffer', async () => {
      const buff = Buffer.from([0])
      let target: any
      let options: any
      const ret: any = {}
      // @ts-ignore
      vi.mocked(fromBuffer).mockImplementationOnce((_target, _options, cb) => {
        target = _target
        options = _options
        cb(undefined, ret)
      })
      await expect(open(buff)).resolves.toEqual(ret)
      expect(target).toEqual(buff)
      expect(options).toEqual({ autoClose: false, lazyEntries: true })
    })
    test('should call yauzl fromFd', async () => {
      const value = 1
      let target: any
      let options: any
      const ret: any = {}
      // @ts-ignore
      vi.mocked(fromFd).mockImplementationOnce((_target: number, _options: any, cb: any) => {
        target = _target
        options = _options
        cb(undefined, ret)
      })
      await expect(open(value)).resolves.toEqual(ret)
      expect(target).toEqual(value)
      expect(options).toEqual({ autoClose: false, lazyEntries: true })
    })
    test('should catch error', async () => {
      // @ts-ignore
      vi.mocked(yopen).mockImplementationOnce((_target: any, _options: any, cb: any) => {
        cb(new Error('ERROR!'))
      })
      await expect(open('test.zip')).rejects.toEqual(new Error('ERROR!'))
      // @ts-ignore
      vi.mocked(yopen).mockImplementationOnce((_target: any, _options: any, cb: any) => {
        cb(undefined)
      })
      await expect(open('test.zip')).rejects.toEqual(
        Object.assign(new Error('Fail to open zip file'), { name: 'InvalidZipFile' }),
      )
    })
  })
})
