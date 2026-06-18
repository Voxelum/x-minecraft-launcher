import { kServiceFactory, useService } from '@/composables'
import { useDialog } from '@/composables/dialog'
import { kInstance } from '@/composables/instance'
import { kInstances } from '@/composables/instances'
import { useNotifier } from '@/composables/notifier'
import { AddInstanceDialogKey } from '@/composables/instanceTemplates'
import { useUserMenuControl } from '@/composables/userMenu'
import { kUserContext } from '@/composables/user'
import { injection } from '@/util/inject'
import {
  CommandContext,
  CommandRegistry,
  InstanceNotFoundError,
  PromptSpec,
  SelectOptions,
  TaskHandle,
  UserNotFoundError,
  commands as defaultCommands,
  registerBuiltinCommands,
} from '@xmcl/runtime-api'
import { Instance } from '@xmcl/instance'
import { UserProfile } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Renderer-side command host. Wires {@link CommandContext} to the
 * existing service proxies and reactive state, so commands defined in
 * `@xmcl/runtime-api` can be dispatched from the palette without
 * duplicating service plumbing.
 */
export interface RendererCommandHost {
  registry: CommandRegistry
  list(): Array<{ id: string; title: string; description: string; category: string; ui?: { icon?: string } }>
  dispatch<O = unknown>(id: string, input: unknown): Promise<O>
}

export const kRendererCommandHost: InjectionKey<RendererCommandHost> = Symbol('RendererCommandHost')

const hiddenRendererCommands = new Set([
  'instance.list',
  'user.list',
  'user.logout',
  'mod.install',
  'resourcepack.install',
  'shaderpack.install',
  'save.install',
])

/**
 * Creates the command host backed by injected stores. Must be called
 * within a Vue setup that has `kInstances` and `kUserContext` provided.
 */
export function useRendererCommandHost(registry: CommandRegistry = defaultCommands): RendererCommandHost {
  // Ensure built-ins are registered. Idempotent — safe to call multiple times.
  registerBuiltinCommands()

  const { notify } = useNotifier()
  const instancesCtx = injection(kInstances)
  const instanceCtx = injection(kInstance)
  const userCtx = injection(kUserContext)
  const factory = injection(kServiceFactory)
  const { show: showAddInstanceDialog } = useDialog(AddInstanceDialogKey)
  const { show: showDeleteInstanceDialog } = useDialog('delete-instance')
  const userMenu = useUserMenuControl()
  const { t, te, locale } = useI18n()

  function getCurrentInstance() {
    return instancesCtx.instances.value.find((instance) => instance.path === instanceCtx.path.value)
  }

  const ctx: CommandContext = {
    mode: 'renderer',
    signal: new AbortController().signal,
    async call(key, method, ...args) {
      const service = factory.getService(key)
      const fn = (service as any)[method]
      if (typeof fn !== 'function') {
        throw new Error(`Service '${String(key)}' has no method '${String(method)}'`)
      }
      return fn.apply(service, args)
    },
    async state() {
      throw new Error('CommandContext.state is not implemented for the renderer host')
    },
    async resolveInstance(ref: string): Promise<Instance> {
      const all = instancesCtx.instances.value
      const byPath = all.find((i) => i.path === ref)
      if (byPath) return byPath
      const byName = all.find((i) => i.name === ref)
      if (byName) return byName
      throw new InstanceNotFoundError(ref)
    },
    async resolveUser(ref?: string): Promise<UserProfile> {
      const users = userCtx.users.value as UserProfile[]
      if (ref) {
        const found = users.find((u) => u.id === ref || u.username === ref)
        if (!found) throw new UserNotFoundError(ref)
        return found
      }
      const selected = userCtx.userProfile.value
      if (selected && selected.id) return selected
      if (users.length > 0) return users[0]
      throw new UserNotFoundError('(no user)')
    },
    async pickInstance(): Promise<Instance> {
      const current = getCurrentInstance()
      if (current) return current
      const all = instancesCtx.instances.value
      if (all.length > 0) return all[0]
      throw new InstanceNotFoundError('(no instance)')
    },
    async pickUser(): Promise<UserProfile> {
      const users = userCtx.users.value as UserProfile[]
      if (users.length > 0) return users[0]
      throw new UserNotFoundError('(no user)')
    },
    async prompt(spec: PromptSpec): Promise<string> {
      // Minimal browser prompt — palette will eventually generate
      // proper Vuetify forms from the command's Zod schema.
      const value = window.prompt(spec.message, spec.default ?? '')
      if (value === null) throw new Error(`Cancelled prompt for '${spec.field}'`)
      return value
    },
    async confirm(message: string): Promise<boolean> {
      return window.confirm(message)
    },
    async select<T>(options: SelectOptions<T>): Promise<T> {
      // Palette currently doesn't render generic selects; fall back to
      // the first item so at least built-in flows progress.
      if (options.items.length === 0) throw new Error(`No items for '${options.field}'`)
      return options.items[0].value
    },
    async task<T>(_name: string, run: (handle: TaskHandle) => Promise<T>): Promise<T> {
      const handle: TaskHandle = {
        update: () => undefined,
        child: () => handle,
      }
      return run(handle)
    },
    out: {
      log(message: string) {
        notify({ title: message, level: 'info' })
      },
      json: () => undefined,
      table: () => undefined,
    },
  }

  return {
    registry,
    list() {
      // Explicitly read `locale` so that callers wrapping `list()` in a
      // `computed` will re-evaluate when the active language changes.
      void locale.value
      return registry.list({ mode: 'renderer' })
        .filter((command) => !hiddenRendererCommands.has(command.id))
        .map((command) => {
          const titleKey = `command.${command.id}.title`
          const descKey = `command.${command.id}.description`
          const translated = t(titleKey)
          const translatedDesc = t(descKey)
          return {
            id: command.id,
            title: translated !== titleKey ? translated : command.title,
            description: translatedDesc !== descKey ? translatedDesc : (command.description ?? command.id),
            category: command.category,
            ui: command.ui,
          }
        })
    },
    async dispatch<O>(id: string, input: unknown): Promise<O> {
      if (id === 'instance.create') {
        showAddInstanceDialog()
        return undefined as O
      }

      if (id === 'instance.delete') {
        const raw = (input ?? {}) as { instance?: string }
        const target = raw.instance ? await ctx.resolveInstance(raw.instance) : await ctx.pickInstance()
        showDeleteInstanceDialog({ name: target.name, path: target.path })
        return undefined as O
      }

      if (id === 'user.login') {
        userMenu.show('login')
        return undefined as O
      }

      return registry.dispatch<O>(id, input, ctx)
    },
  }
}
