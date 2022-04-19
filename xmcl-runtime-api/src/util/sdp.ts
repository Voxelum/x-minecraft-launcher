export function createOfferLauncherUrl(description: string) {
  return `xmcl://peer/offer/${description}`
}

export function createAnswerLauncherUrl(description: string) {
  return `xmcl://peer/answer/${description}`
}

export function createOfferAppUrl(description: string, inviter: string) {
  return `https://xmcl.app/peer?description=${description}?type=offer?inviter=${inviter}`
}

export function createAnswerAppUrl(description: string, inviter: string) {
  return `https://xmcl.app/peer?description=${description}?type=answer?inviter=${inviter}`
}
