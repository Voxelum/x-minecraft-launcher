// @ts-nocheck
/* eslint-disable */

import { Color, Vector3 } from 'three'

Number.prototype.clamp = function (min, max) { return Math.min(Math.max(this, min), max) }

export function extend(a, b) {
  for (const key in b) {
    if (b.hasOwnProperty(key)) { a[key] = b[key] }
  }
  return a
}

export function toVector3(color: Color) {
  return new Vector3(color.r, color.g, color.b)
}

export function mobileCheck() {
  if (typeof navigator !== 'undefined') {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 600
  }
  return null
}
export const sample = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]

export function rn(start: number, end: number) {
  if (start == null) start = 0
  if (end == null) end = 1
  return start + (Math.random() * (end - start))
}

export function ri(start: number, end: number) {
  if (start == null) start = 0
  if (end == null) end = 1
  return Math.floor(start + (Math.random() * ((end - start) + 1)))
}

export const q = sel => document.querySelector(sel)

export const color2Hex = (color: number | string) => {
  if (typeof color === 'number') {
    return '#' + ('00000' + color.toString(16)).slice(-6)
  } else return color
}

export const color2Rgb = (color: number | string, alpha = 1) => {
  const hex = color2Hex(color)
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  const obj = result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : null
  return 'rgba(' + obj.r + ',' + obj.g + ',' + obj.b + ',' + alpha + ')'
}

export const getBrightness = (threeColor) => {
  return (0.299 * threeColor.r) + (0.587 * threeColor.g) + (0.114 * threeColor.b)
}
