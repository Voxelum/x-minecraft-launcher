export function useBroadcastChannel(name: string) {
  const channel = new BroadcastChannel(name)

  onUnmounted(() => {
    channel.close()
  })

  return channel
}
