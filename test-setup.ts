import { join } from 'path'
import { beforeEach } from 'vitest'

beforeEach((context) => {
  context.mock = join(__dirname, 'mock')
  context.temp = join(__dirname, 'temp')
})
