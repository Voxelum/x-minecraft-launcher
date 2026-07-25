export function shouldSubmitAgentInput(event: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>, composing: boolean) {
  return !composing && !event.isComposing && event.keyCode !== 229
}

export function getAgentEscapeAction(running: boolean): 'abort' | 'close' {
  return running ? 'abort' : 'close'
}
