import { InjectionKey, Ref } from '@vue/composition-api';
import { Clipboard, Dialog, IpcRenderer, RendererInterface } from 'electron';
import { BuiltinServices } from '@main/service';
import { Store } from '@universal/store';
import { TaskState } from '@universal/task';
import VueI18n from 'vue-i18n';
import VueRouter from 'vue-router';

export const REMOTE_DIALOG_KEY: InjectionKey<Dialog> = Symbol('REMOTE_DIALOG_KEY');
export const ELECTRON_CLIPBOARD: InjectionKey<Clipboard> = Symbol('ELECTRON_CLIPBOARD');
export const IPC_KEY: InjectionKey<IpcRenderer> = Symbol('IPC_KEY');
export const STORE_KEY: InjectionKey<Store> = Symbol('STORE_KEY');
export const ROUTER_KEY: InjectionKey<VueRouter> = Symbol('ROUTER_KEY');
export const SERVICES_KEY: InjectionKey<BuiltinServices> = Symbol('SERVICES_KEY');
export const SERVICES_SEMAPHORE_KEY: InjectionKey<Record<string, number>> = Symbol('SERVICES_SHEMAPHORE_KEY');
export const I18N_KEY: InjectionKey<VueI18n> = Symbol('I18N_KEY');

export const TASK_DICT_KEY: InjectionKey<{ [key: string]: TaskState }> = Symbol('TASK_DICT_KEY');
export const TASKS_KEY: InjectionKey<Ref<TaskState[]>> = Symbol('TASKS_KEY');
export const TASKS_OPS_KEY: InjectionKey<{ pause: (id: string) => void; resume: (id: string) => void; cancel: (id: string) => void }> = Symbol('TASK_OPS_KEY');

export const SEARCH_TEXT_KEY: InjectionKey<string> = Symbol('SEARCH_TEXT_KEY');

export const electron: RendererInterface = (window as any).electron;
export const ipcRenderer: IpcRenderer = electron.ipcRenderer;
export const dialog: Dialog = electron.dialog;
export const clipboard: Clipboard = electron.clipboard;
