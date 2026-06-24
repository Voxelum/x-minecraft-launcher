import { describe, expect, it } from 'vitest'
import { JavaValidation, classifyJavaInstallFailure } from './java'

describe('classifyJavaInstallFailure', () => {
  it('reports download-or-extract when the binary never landed', () => {
    expect(classifyJavaInstallFailure({ exeExists: false, validation: undefined }))
      .toBe('download-or-extract')
    // Missing binary dominates even if validation somehow computed.
    expect(classifyJavaInstallFailure({ exeExists: false, validation: JavaValidation.NotExisted }))
      .toBe('download-or-extract')
  })

  it('reports permission when the binary exists but is not executable', () => {
    expect(classifyJavaInstallFailure({ exeExists: true, validation: JavaValidation.NoPermission }))
      .toBe('permission')
  })

  it('reports parse-or-spawn when the binary exists and is accessible but unresolvable', () => {
    expect(classifyJavaInstallFailure({ exeExists: true, validation: JavaValidation.Okay }))
      .toBe('parse-or-spawn')
    // Unknown validation with an existing exe still points at spawn/parse.
    expect(classifyJavaInstallFailure({ exeExists: true, validation: undefined }))
      .toBe('parse-or-spawn')
  })
})
