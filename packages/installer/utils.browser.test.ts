import { describe, test, expect, vi, beforeEach } from 'vitest'
import {
  normalizeArray,
  joinUrl,
  errorToString,
  doFetch,
  resolveDownloadUrls,
  runWithDiagnose,
  runWithDiagnoseOnce,
} from './utils.browser'

describe('utils.browser', () => {
  describe('normalizeArray', () => {
    test('should return array as-is', () => {
      const input = ['a', 'b', 'c']
      expect(normalizeArray(input)).toEqual(input)
    })

    test('should wrap single value in array', () => {
      expect(normalizeArray('single')).toEqual(['single'])
    })

    test('should return empty array for undefined', () => {
      expect(normalizeArray()).toEqual([])
    })

    test('should handle number', () => {
      expect(normalizeArray(42)).toEqual([42])
    })

    test('should handle object', () => {
      const obj = { key: 'value' }
      expect(normalizeArray(obj)).toEqual([obj])
    })
  })

  describe('joinUrl', () => {
    test('should join urls with both having slash', () => {
      expect(joinUrl('https://example.com/', '/path')).toBe('https://example.com/path')
    })

    test('should join urls with neither having slash', () => {
      expect(joinUrl('https://example.com', 'path')).toBe('https://example.com/path')
    })

    test('should join urls with first having slash', () => {
      expect(joinUrl('https://example.com/', 'path')).toBe('https://example.com/path')
    })

    test('should join urls with second having slash', () => {
      expect(joinUrl('https://example.com', '/path')).toBe('https://example.com/path')
    })

    test('should handle multiple path segments', () => {
      const base = 'https://example.com/'
      const path = '/path/to/resource'
      expect(joinUrl(base, path)).toBe('https://example.com/path/to/resource')
    })

    test('should handle empty paths', () => {
      expect(joinUrl('https://example.com', '')).toBe('https://example.com/')
    })
  })

  describe('errorToString', () => {
    test('should return stack for Error with stack', () => {
      const error = new Error('Test error')
      const result = errorToString(error)
      expect(result).toContain('Test error')
      expect(result).toContain('at ')
    })

    test('should return message for Error without stack', () => {
      const error = new Error('Test error')
      error.stack = undefined
      expect(errorToString(error)).toBe('Test error')
    })

    test('should call toString for non-Error', () => {
      expect(errorToString('string error')).toBe('string error')
      expect(errorToString(42)).toBe('42')
      expect(errorToString({ toString: () => 'custom' })).toBe('custom')
    })

    test('should handle null and undefined', () => {
      expect(errorToString(null)).toBeUndefined()
      expect(errorToString(undefined)).toBeUndefined()
    })
  })

  describe('doFetch', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    test('should use global fetch when no custom fetch provided', async () => {
      const mockResponse = { ok: true, json: async () => ({ data: 'test' }) }
      const globalFetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse as any)

      await doFetch(undefined, 'https://example.com')

      expect(globalFetchSpy).toHaveBeenCalledWith('https://example.com', { signal: undefined })
    })

    test('should use custom fetch when provided', async () => {
      const customFetch = vi.fn().mockResolvedValue({ ok: true })
      const options = { fetch: customFetch }

      await doFetch(options, 'https://example.com')

      expect(customFetch).toHaveBeenCalledWith('https://example.com', { signal: undefined })
    })

    test('should pass signal to fetch', async () => {
      const controller = new AbortController()
      const customFetch = vi.fn().mockResolvedValue({ ok: true })
      const options = { fetch: customFetch, signal: controller.signal }

      await doFetch(options, 'https://example.com')

      expect(customFetch).toHaveBeenCalledWith('https://example.com', { signal: controller.signal })
    })

    test('should merge signal with existing init', async () => {
      const controller = new AbortController()
      const customFetch = vi.fn().mockResolvedValue({ ok: true })
      const options = { fetch: customFetch, signal: controller.signal }

      await doFetch(options, 'https://example.com', {
        headers: { 'Content-Type': 'application/json' },
      })

      expect(customFetch).toHaveBeenCalledWith('https://example.com', {
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
    })

    test('should handle undefined options', async () => {
      const globalFetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as any)

      await doFetch(undefined, 'https://example.com', { method: 'POST' })

      expect(globalFetchSpy).toHaveBeenCalledWith('https://example.com', {
        method: 'POST',
        signal: undefined,
      })
    })
  })

  describe('resolveDownloadUrls', () => {
    test('should return original url when no option provided', () => {
      const result = resolveDownloadUrls('https://example.com/file.jar', {})
      expect(result).toEqual(['https://example.com/file.jar'])
    })

    test('should add string option to front', () => {
      const result = resolveDownloadUrls(
        'https://example.com/file.jar',
        {},
        'https://mirror.com/file.jar',
      )
      expect(result).toEqual(['https://mirror.com/file.jar', 'https://example.com/file.jar'])
    })

    test('should add array options to front', () => {
      const result = resolveDownloadUrls('https://example.com/file.jar', {}, [
        'https://mirror1.com/file.jar',
        'https://mirror2.com/file.jar',
      ])
      expect(result).toEqual([
        'https://mirror1.com/file.jar',
        'https://mirror2.com/file.jar',
        'https://example.com/file.jar',
      ])
    })

    test('should use function option', () => {
      const version = { id: '1.0.0' }
      const result = resolveDownloadUrls(
        'https://example.com/file.jar',
        version,
        (v) => `https://mirror.com/${v.id}/file.jar`,
      )
      expect(result).toEqual(['https://mirror.com/1.0.0/file.jar', 'https://example.com/file.jar'])
    })

    test('should use function option returning array', () => {
      const version = { id: '1.0.0' }
      const result = resolveDownloadUrls('https://example.com/file.jar', version, (v) => [
        `https://mirror1.com/${v.id}/file.jar`,
        `https://mirror2.com/${v.id}/file.jar`,
      ])
      expect(result).toEqual([
        'https://mirror1.com/1.0.0/file.jar',
        'https://mirror2.com/1.0.0/file.jar',
        'https://example.com/file.jar',
      ])
    })

    test('should not duplicate original url', () => {
      const result = resolveDownloadUrls(
        'https://example.com/file.jar',
        {},
        'https://example.com/file.jar',
      )
      expect(result).toEqual(['https://example.com/file.jar'])
    })

    test('should handle undefined option', () => {
      const result = resolveDownloadUrls('https://example.com/file.jar', {}, undefined)
      expect(result).toEqual(['https://example.com/file.jar'])
    })
  })

  describe('runWithDiagnose', () => {
    test('should return successful diagnose result', async () => {
      const diagnose = vi.fn().mockResolvedValue('success')
      const fix = vi.fn()
      const options = { diagnose: false }

      const result = await runWithDiagnose(diagnose, fix, options)

      expect(result).toBe('success')
      expect(diagnose).toHaveBeenCalledTimes(1)
      expect(fix).not.toHaveBeenCalled()
    })

    test('should throw error when diagnose is true and diagnose fails', async () => {
      const error = new Error('Diagnose failed')
      const diagnose = vi.fn().mockRejectedValue(error)
      const fix = vi.fn()
      const options = { diagnose: true }

      await expect(runWithDiagnose(diagnose, fix, options)).rejects.toThrow('Diagnose failed')
      expect(diagnose).toHaveBeenCalledTimes(1)
      expect(fix).not.toHaveBeenCalled()
    })

    test('should fix and retry when diagnose is false and diagnose fails', async () => {
      const error = new Error('Diagnose failed')
      const diagnose = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('fixed')
      const fix = vi.fn().mockResolvedValue(undefined)
      const options = { diagnose: false }

      const result = await runWithDiagnose(diagnose, fix, options)

      expect(result).toBe('fixed')
      expect(diagnose).toHaveBeenCalledTimes(2)
      expect(fix).toHaveBeenCalledWith(error)
    })

    test('should handle fix failure', async () => {
      const diagnoseError = new Error('Diagnose failed')
      const fixError = new Error('Fix failed')
      const diagnose = vi.fn().mockRejectedValue(diagnoseError)
      const fix = vi.fn().mockRejectedValue(fixError)
      const options = { diagnose: false }

      await expect(runWithDiagnose(diagnose, fix, options)).rejects.toThrow('Fix failed')
      expect(diagnose).toHaveBeenCalledTimes(1)
      expect(fix).toHaveBeenCalledWith(diagnoseError)
    })
  })

  describe('runWithDiagnoseOnce', () => {
    test('should succeed without calling fix', async () => {
      const diagnose = vi.fn().mockResolvedValue(undefined)
      const fix = vi.fn()
      const options = { diagnose: false }

      await runWithDiagnoseOnce(diagnose, fix, options)

      expect(diagnose).toHaveBeenCalledTimes(1)
      expect(fix).not.toHaveBeenCalled()
    })

    test('should throw error when diagnose is true and diagnose fails', async () => {
      const error = new Error('Diagnose failed')
      const diagnose = vi.fn().mockRejectedValue(error)
      const fix = vi.fn()
      const options = { diagnose: true }

      await expect(runWithDiagnoseOnce(diagnose, fix, options)).rejects.toThrow('Diagnose failed')
      expect(diagnose).toHaveBeenCalledTimes(1)
      expect(fix).not.toHaveBeenCalled()
    })

    test('should fix without retry when diagnose is false and diagnose fails', async () => {
      const error = new Error('Diagnose failed')
      const diagnose = vi.fn().mockRejectedValue(error)
      const fix = vi.fn().mockResolvedValue(undefined)
      const options = { diagnose: false }

      await runWithDiagnoseOnce(diagnose, fix, options)

      expect(diagnose).toHaveBeenCalledTimes(1)
      expect(fix).toHaveBeenCalledWith(error)
    })

    test('should throw fix error', async () => {
      const diagnoseError = new Error('Diagnose failed')
      const fixError = new Error('Fix failed')
      const diagnose = vi.fn().mockRejectedValue(diagnoseError)
      const fix = vi.fn().mockRejectedValue(fixError)
      const options = { diagnose: false }

      await expect(runWithDiagnoseOnce(diagnose, fix, options)).rejects.toThrow('Fix failed')
      expect(diagnose).toHaveBeenCalledTimes(1)
      expect(fix).toHaveBeenCalledWith(diagnoseError)
    })
  })
})
