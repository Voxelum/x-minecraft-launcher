// declare module '*.vue' {
//   import { ComponentOptions, Component } from 'vue'
//   const component: ComponentOptions
//   export default component
// }
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
declare module '*.svg' {
  const value: string
  export default value
}

interface File {
  /**
   * The real path to the file on the users filesystem
   */
  path: string
}
