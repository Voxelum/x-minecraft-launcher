declare module '*.vue' {
  import { ComponentOptions, Component } from 'vue'
  const component: ComponentOptions
  export default component
}
declare module '*.webp' {
  const value: string
  export default value
}
declare module 'vue-virtual-scroll-list' {

  const component: import('vue').Component<any, any, any, { size: number; remain: number }>
  export = component
}

declare module '/@/assets/locales/index.json' {
  type Locale = {
    [range: string]: string
  }
  const locale: Locale
  export = locale
}

declare module '*.png' {
  const value: string
  export default value
}

// declare const taskChannel: import('@xmcl/runtime-api').TaskChannel
// declare const semaphoreChannel: import('@xmcl/runtime-api').SemaphoreChannel
// declare const serviceChannel: import('@xmcl/runtime-api').ServiceChannel
// declare const controllerChannel: import('@xmcl/runtime-api').ControllerChannel
