import { describe, expect, it, vi } from 'vitest'
import { runShaderPackLangJob } from './shaderPackLangJob'

const document = {
  path: 'lang/en_us.lang',
  locale: 'en_us',
  targetPath: 'lang/zh_cn.lang',
  targetExists: true,
  targetKeys: ['existing'],
  entries: [{ key: 'existing', value: 'Official' }, { key: 'missing', value: 'New' }],
}
const translated = [{ key: 'missing', value: '新增' }]
const result = { path: document.targetPath, fileName: 'pack.translated-zh_cn.zip', written: 1, bytes: 12 }

function setup() {
  let version = 0
  const read = vi.fn(async () => document)
  const translate = vi.fn(async () => translated)
  const commit = vi.fn(async () => result)
  return {
    read, translate, commit,
    cancel: () => { version++ },
    start: () => {
      const current = ++version
      return runShaderPackLangJob({ isCurrent: () => current === version, read, translate, commit })
    },
  }
}

describe('runShaderPackLangJob', () => {
  it('sends and commits only keys absent from the target', async () => {
    const job = setup()
    expect(await job.start()).toEqual(result)
    expect(job.translate).toHaveBeenCalledWith([document.entries[1]])
    expect(job.commit).toHaveBeenCalledWith(translated)
  })

  it('does not send text or commit if cancelled while reading', async () => {
    const job = setup()
    const pending = job.start()
    job.cancel()
    expect(await pending).toBeUndefined()
    expect(job.translate).not.toHaveBeenCalled()
    expect(job.commit).not.toHaveBeenCalled()
  })

  it('does not commit late provider results after cancelling and starting another job', async () => {
    const job = setup()
    const late = Promise.withResolvers<typeof translated>()
    job.translate.mockReturnValueOnce(late.promise)
    const stale = job.start()
    await Promise.resolve()
    expect(job.translate).toHaveBeenCalledTimes(1)
    job.cancel()
    expect(await job.start()).toEqual(result)
    late.resolve(translated)
    expect(await stale).toBeUndefined()
    expect(job.commit).toHaveBeenCalledTimes(1)
  })
})
