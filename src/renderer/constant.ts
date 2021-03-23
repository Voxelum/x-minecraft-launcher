import { InjectionKey } from '@vue/composition-api'
import type { Clipboard, Dialog, IpcRenderer } from 'electron'
import VueI18n from 'vue-i18n'
import VueRouter from 'vue-router'
import { TaskProxy } from './taskProxy'
import { ServiceKey } from '/@shared/services/Service'
import { Store } from '/@shared/store'

export type ServiceProxy = <T>(key: ServiceKey<T>) => T

export const REMOTE_DIALOG_KEY: InjectionKey<Dialog> = Symbol('REMOTE_DIALOG_KEY')
export const ELECTRON_CLIPBOARD: InjectionKey<Clipboard> = Symbol('ELECTRON_CLIPBOARD')
export const IPC_KEY: InjectionKey<IpcRenderer> = Symbol('IPC_KEY')
export const STORE_KEY: InjectionKey<Store> = Symbol('STORE_KEY')
export const ROUTER_KEY: InjectionKey<VueRouter> = Symbol('ROUTER_KEY')
export const SERVICES_KEY: InjectionKey<ServiceProxy> = Symbol('SERVICES_KEY')
export const SERVICES_SEMAPHORE_KEY: InjectionKey<Record<string, number>> = Symbol('SERVICES_SHEMAPHORE_KEY')
export const I18N_KEY: InjectionKey<VueI18n> = Symbol('I18N_KEY')

export const TASK_PROXY: InjectionKey<TaskProxy> = Symbol('TASK_PROXY')

export const SEARCH_TEXT_KEY: InjectionKey<string> = Symbol('SEARCH_TEXT_KEY')

export const electron = (window as any).electron
export const ipcRenderer: IpcRenderer = electron.ipcRenderer
export const dialog: Dialog = electron.dialog
export const clipboard: Clipboard = electron.clipboard
