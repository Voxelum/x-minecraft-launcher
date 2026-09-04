import { describe, expect, it } from 'vitest'
import { getServiceFailureCategory } from './error_category'

describe('getServiceFailureCategory', () => {
  it('classifies nested download errors without using their message', () => {
    expect(getServiceFailureCategory(new AggregateError([
      Object.assign(new Error('private path'), { name: 'InstallFileDownloadError', code: 'ECONNRESET' }),
    ]))).toBe('download')
  })

  it('classifies actionable local and postprocess failures', () => {
    expect(getServiceFailureCategory({ code: 'ENOSPC' })).toBe('disk-full')
    expect(getServiceFailureCategory({ code: 'EACCES' })).toBe('permission')
    expect(getServiceFailureCategory({ name: 'ProcessExitError' })).toBe('postprocess')
    expect(getServiceFailureCategory({ name: 'MissingVersionJson' })).toBe('version-parse')
  })
})