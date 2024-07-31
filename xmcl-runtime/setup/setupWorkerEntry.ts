import { setHandler } from '../worker/helper'
import { getDiskInfo } from 'node-disk-info'

setHandler({ getDiskInfo })
