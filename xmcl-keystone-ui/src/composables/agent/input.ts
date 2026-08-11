export function shouldSubmitAgentInput(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'isComposing' | 'keyCode'>,
  composing: boolean,
) {
  return event.key === 'Enter' && !event.shiftKey && !composing && !event.isComposing && event.keyCode !== 229
}

export function getAgentEscapeAction(_running: boolean): 'abort' | 'close' {
  return 'close'
}
