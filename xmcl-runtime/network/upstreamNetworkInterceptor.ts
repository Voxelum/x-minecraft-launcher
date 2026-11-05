import type { Dispatcher } from 'undici'
import { isUpstreamLauncherUrl } from './upstreamNetworkPolicy'

export const upstreamNetworkInterceptor: Dispatcher.DispatcherComposeInterceptor = (dispatch) => (options, handler) => {
  // Dispatcher paths beginning with // are still paths on options.origin.
  // Relative URL resolution would instead check a different authority.
  const origin = new URL(options.origin!.toString()).origin
  const url = new URL(origin + options.path)
  if (isUpstreamLauncherUrl(url)) {
    throw new Error('Upstream launcher service is disabled')
  }
  return dispatch(options, handler)
}
