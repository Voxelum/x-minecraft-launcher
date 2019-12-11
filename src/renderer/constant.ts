import { InjectionKey } from '@vue/composition-api';
import { Dialog, IpcRenderer, Shell, Clipboard, RendererInterface } from 'electron';
import { Store } from 'universal/store';
import { BuiltinServices } from 'main/service';
import VueRouter from 'vue-router';
import VueI18n from 'vue-i18n';

export const REMOTE_DIALOG_KEY: InjectionKey<Dialog> = Symbol('REMOTE_DIALOG_KEY');
export const REMOTE_SHELL_KEY: InjectionKey<Shell> = Symbol('REMOTE_SHELL_KEY');
export const ELECTRON_CLIPBOARD: InjectionKey<Clipboard> = Symbol('ELECTRON_CLIPBOARD');
export const IPC_KEY: InjectionKey<IpcRenderer> = Symbol('IPC_KEY');
export const STORE_KEY: InjectionKey<Store> = Symbol('STORE_KEY');
export const ROUTER_KEY: InjectionKey<VueRouter> = Symbol('ROUTER_KEY');
export const SERVICES_KEY: InjectionKey<BuiltinServices> = Symbol('SERVICES_KEY');
export const I18N_KEY: InjectionKey<VueI18n> = Symbol('I18N_KEY');

export const SEARCH_TEXT_KEY: InjectionKey<string> = Symbol('SEARCH_TEXT_KEY');

export const electron: RendererInterface = (window as any).electron;
export const ipcRenderer: IpcRenderer = electron.ipcRenderer;
export const shell: Shell = electron.shell;
export const dialog: Dialog = electron.dialog;
export const clipboard: Clipboard = electron.clipboard;
