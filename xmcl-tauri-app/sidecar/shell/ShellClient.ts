import { EventEmitter } from 'events'
import { createInterface } from 'readline'
import { SHELL_MARKER, ShellCommand, ShellEvent, WindowSpec } from '../../bridge/shell'

export interface ShellClient {
  on(event: 'window-closed', listener: (label: string) => void): this
  on(event: 'window-all-closed', listener: () => void): this
  on(event: 'second-instance', listener: (argv: string[]) => void): this
  on(event: 'deep-link', listener: (url: string) => void): this
  on(event: 'tray-click', listener: (id: string) => void): this
}

/**
 * Sidecar half of the shell control channel: commands go out on stdout,
 * shell events come in on stdin (see `bridge/shell.ts`).
 */
export class ShellClient extends EventEmitter {
  constructor(private readonly out: NodeJS.WritableStream = process.stdout, input: NodeJS.ReadableStream = process.stdin) {
    super()
    createInterface({ input }).on('line', (line) => {
      if (!line) return
      let event: ShellEvent
      try {
        event = JSON.parse(line)
      } catch {
        return
      }
      if (event.type === 'second-instance') {
        this.emit(event.type, event.argv)
      } else if (event.type === 'window-closed') {
        this.emit(event.type, event.label)
      } else if (event.type === 'deep-link') {
        this.emit(event.type, event.url)
      } else if (event.type === 'tray-click') {
        this.emit(event.type, event.id)
      } else {
        this.emit(event.type)
      }
    })
  }

  send(command: ShellCommand) {
    this.out.write(SHELL_MARKER + JSON.stringify(command) + '\n')
  }

  openWindow(spec: WindowSpec) {
    this.send({ type: 'open-window', spec })
  }

  closeWindow(label: string) {
    this.send({ type: 'close-window', label })
  }

  focusWindow(label: string) {
    this.send({ type: 'focus-window', label })
  }

  showWindow(label: string) {
    this.send({ type: 'show-window', label })
  }

  quit() {
    this.send({ type: 'quit' })
  }

  exit(code = 0) {
    this.send({ type: 'exit', code })
  }

  relaunch(args?: string[]) {
    this.send({ type: 'relaunch', args })
  }

  registerProtocol(protocol: string) {
    this.send({ type: 'register-protocol', protocol })
  }
}
