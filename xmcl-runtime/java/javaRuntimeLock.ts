import { AsyncLocalStorage } from 'async_hooks'
import { join, resolve } from 'path'
import type { LauncherApp } from '~/app'
import { getManagedJavaComponent } from './java'

const contexts = new WeakMap<LauncherApp, AsyncLocalStorage<{ active: boolean; key: string }>>()

/** Key a lock by managed runtime so its java and javaw executables share it. */
export function javaRuntimeLockKey(app: LauncherApp, javaPath: string, root: string) {
  const component = getManagedJavaComponent(javaPath, root)?.component
  const path = component ? join(resolve(root), component) : resolve(javaPath)
  return app.platform.os === 'windows' ? path.toLowerCase() : path
}

/** Serialize runtime operations, permitting nested calls by the current lock owner. */
export async function withJavaRuntimeLock<T>(app: LauncherApp, key: string, action: () => Promise<T>): Promise<T> {
  let context = contexts.get(app)
  if (!context) {
    context = new AsyncLocalStorage()
    contexts.set(app, context)
  }
  const current = context.getStore()
  // Nested operations may reuse the lock only while its owning action is active.
  if (current?.active && current.key === key) return action()

  return app.mutex.of(`java/runtime-process/${key}`).runExclusive(async () => {
    const token = { active: true, key }
    return context.run(token, async () => {
      try {
        return await action()
      } finally {
        token.active = false
      }
    })
  })
}
