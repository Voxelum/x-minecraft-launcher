import { join, normalize } from 'path'
import { checksum, validateSha1 } from './utils'
import { describe, test, expect } from 'vitest'

const root = normalize(join(__dirname, '..', '..', 'mock'))

describe('util', () => {
  describe('#validateSha1', () => {
    test('should return false if the file not found', async () => {
      await expect(validateSha1(join(root, 'test.ss'))).resolves.toEqual(false)
    })
    test('should return false if the sha not matched', async () => {
      await expect(validateSha1(join(root, 'options.txt'), 'abc')).resolves.toEqual(false)
    })
    test('should return true if the sha matched', async () => {
      await expect(
        validateSha1(join(root, 'options.txt'), 'e1719c99026ae3714ea24f13f50cdf6894844511'),
      ).resolves.toEqual(true)
    })
    test('should return true if the sha not given and file existed in non strict', async () => {
      await expect(validateSha1(join(root, 'options.txt'))).resolves.toEqual(true)
    })
    test('should return false if the sha not given and file existed in strict', async () => {
      await expect(validateSha1(join(root, 'options.txt'), undefined, true)).resolves.toEqual(false)
    })
  })
  describe('#checksum', () => {
    test('should get sha1', async () => {
      await expect(checksum(join(root, 'options.txt'), 'sha1')).resolves.toEqual(
        'e1719c99026ae3714ea24f13f50cdf6894844511',
      )
    })
  })
})
