import { setHandler } from '@xmcl/runtime/worker/helper'
import { getDiskInfo } from 'node-disk-info'

setHandler({ getDiskInfo })
