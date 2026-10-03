import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { useJavaImport } from './javaImport'

const { resolveJava, showOpenDialog } = vi.hoisted(() => ({
  resolveJava: vi.fn(),
  showOpenDialog: vi.fn(),
}))
vi.mock('./service', () => ({ useService: () => ({ resolveJava }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('manual Java import', () => {
  const path = 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.101-hotspot\\bin\\java.exe'
  const java = { path, majorVersion: 17, version: '17.0.20' }

  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('windowController', { showOpenDialog })
    showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [path] })
    resolveJava.mockResolvedValue(java)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('awaits executable validation before opening the Java picker', async () => {
    const added = vi.fn()
    const { browse, importing, error } = useJavaImport(added)
    const pending = browse()
    expect(importing.value).toBe(true)
    expect(added).not.toHaveBeenCalled()
    await pending
    expect(showOpenDialog).toHaveBeenCalledWith({
      title: 'java.importFromFile', properties: ['openFile'],
    })
    expect(resolveJava).toHaveBeenCalledWith(path)
    expect(added).toHaveBeenCalledWith(java)
    expect(importing.value).toBe(false)
    expect(error.value).toBe('')
  })

  it.each([
    { canceled: true, filePaths: [path] },
    { canceled: false, filePaths: [] },
  ])('leaves selection unchanged on cancellation or an empty selection: %j', async result => {
    showOpenDialog.mockResolvedValue(result)
    const added = vi.fn()
    const { browse, error } = useJavaImport(added)
    await browse()
    expect(resolveJava).not.toHaveBeenCalled()
    expect(added).not.toHaveBeenCalled()
    expect(error.value).toBe('')
  })

  it('reports invalid Java paths and permits retrying with a valid executable', async () => {
    resolveJava.mockResolvedValueOnce(undefined)
    const added = vi.fn()
    const { browse, error } = useJavaImport(added)
    await browse()
    expect(error.value).toBe(`java.invalid: ${path}`)
    expect(added).not.toHaveBeenCalled()
    await browse()
    expect(error.value).toBe('')
    expect(added).toHaveBeenCalledWith(java)
  })

  it.each(['dialog', 'resolver'])('surfaces %s failures without a successful import', async source => {
    const failure = new Error('Access denied')
    ;(source === 'dialog' ? showOpenDialog : resolveJava).mockRejectedValue(failure)
    const added = vi.fn()
    const { browse, importing, error } = useJavaImport(added)
    await browse()
    expect(error.value).toBe('Access denied')
    expect(importing.value).toBe(false)
    expect(added).not.toHaveBeenCalled()
  })

  it('ignores repeated clicks while the dialog or validation is pending', async () => {
    const added = vi.fn()
    const { browse } = useJavaImport(added)
    await Promise.all([browse(), browse()])
    expect(showOpenDialog).toHaveBeenCalledTimes(1)
    expect(resolveJava).toHaveBeenCalledTimes(1)
    expect(added).toHaveBeenCalledTimes(1)
  })

  it('preserves error messages serialized across the service bridge', async () => {
    resolveJava.mockRejectedValue({ name: 'Error', message: 'Java executable is not accessible' })
    const { browse, error } = useJavaImport(vi.fn())
    await browse()
    expect(error.value).toBe('Java executable is not accessible')
  })
})
