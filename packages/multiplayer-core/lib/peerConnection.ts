export interface PeerConnectionProvider {
  createPeerConnection(configuration: RTCConfiguration): RTCPeerConnection
}

export const defaultPeerConnectionProvider: PeerConnectionProvider = {
  createPeerConnection: (configuration) => new RTCPeerConnection(configuration),
}

export async function createLocalOffer(
  connection: RTCPeerConnection,
  options?: RTCOfferOptions,
) {
  const offer = connection.createOffer(options)
  const configuration = connection.getConfiguration?.() as (RTCConfiguration & {
    enableIceUdpMux?: boolean
  }) | undefined
  if (configuration?.enableIceUdpMux) {
    await connection.setLocalDescription({ type: 'offer' })
    return offer
  }
  const description = await offer
  await connection.setLocalDescription(description)
  return description
}
