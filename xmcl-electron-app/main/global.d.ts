/* eslint-disable no-unused-vars */

// declare electron static for static file serving
/* eslint-disable no-unused-vars */

// declare electron static for static file serving

declare module '*?worker' {
  import { Worker, WorkerOptions } from 'worker_threads'
  /**
   * The helper to create the worker
   */
  export default function (options?: WorkerOptions): Worker
}

declare module '*.cs' {
  const content: string
  export default content
}

declare module '@renderer/*.html' {
  /**
   * The url of the page
   */
  const url: string
  export default url
}

declare module '@preload/*' {
  const url: string
  export default url
}

declare module '@renderer/*' {
  const noop: never
  export default noop
}

declare module '*.png' {
  /**
   * The path of the static file
   */
  const path: string
  export default path
}

declare module '*.svg' {
  /**
   * The path of the static file
   */
  const path: string
  export default path
}

declare module '*.gif' {
  /**
   * The path of the static file
   */
  const path: string
  export default path
}

declare module '*.ico' {
  /**
   * The path of the static file
   */
  const path: string
  export default path
}

declare module '@renderer/*' {
  /**
   * The path of the preload file
   */
  const path: string
  export default path
}

declare module '7zip-bin' {
  export const path7za: string
}

declare module '*?static' {
  const path: string
  export default path
}

declare module 'create-desktop-shortcuts' {
  interface CreateDesktopShortcutOptions {
    onlyCurrentOS?: boolean
    verbose?: boolean

    windows?: {
      filePath: string
      outputPath?: string
      name?: string
      comment?: string
      /**
       *  File must exist and be ICO, EXE, or DLL
       */
      icon?: string
      arguments?: string
      windowMode?: string
      hotkey?: string
    }

    linux?: {
      filePath: string
      outputPath?: string
      name?: string
      description?: string
      /**
       * OPTIONAL: defaults to the filePath file's name (without the extension)
       */
      icon?: string
      type?: 'Application' | 'Directory' | 'Link'
      terminal?: boolean
      chmod?: boolean
      arguments?: string
    }

    osx?: {
      filePath: string
      outputPath?: string
      name?: string
      overwrite?: boolean
    }
  }

  function createDesktopShortcut(options: CreateDesktopShortcutOptions): boolean

  export = createDesktopShortcut
}
