import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { useDialogModel, type DialogModelData } from './dialog'

class MemoryDialogChannel {
  static channels: MemoryDialogChannel[] = []
  static messages = 0

  private listener: ((event: MessageEvent) => void) | undefined

  constructor() {
    MemoryDialogChannel.channels.push(this)
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void) {
    this.listener = listener
  }

  postMessage(message: DialogModelData<unknown>) {
    MemoryDialogChannel.messages += 1
    for (const channel of MemoryDialogChannel.channels) {
      if (channel !== this) channel.listener?.({ data: structuredClone(message) } as MessageEvent)
    }
  }
}

describe('dialog model', () => {
  it('does not echo a dialog update received from another window', async () => {
    MemoryDialogChannel.channels = []
    MemoryDialogChannel.messages = 0
    const first = useDialogModel(new MemoryDialogChannel())
    const second = useDialogModel(new MemoryDialogChannel())

    first.current.value = { dialog: 'multiplayer-login', parameter: undefined }
    await nextTick()
    await nextTick()

    expect(second.current.value.dialog).toBe('multiplayer-login')
    expect(MemoryDialogChannel.messages).toBe(1)
  })
})