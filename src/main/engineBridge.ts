/**
 * Represent a long lived connection between the main process (server) and renderer process (client)
 */
export interface Client {
  send(channel: string, ...payload: any[]): void
}

export type { Dialog, Notification, NotificationAction, NotificationConstructorOptions, BrowserView, BrowserWindow, BrowserWindowConstructorOptions, Dock, Tray, Menu, MenuItem, MenuItemConstructorOptions } from 'electron'
