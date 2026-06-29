import { setHandler } from '@xmcl/worker/helper'
import { getSerializedError } from '~/infra/errors/error_serialize'
import { renderSaveRegion } from './region'
import { SaveWorker } from './saveWorker'

const handler: SaveWorker = {
  renderSaveRegion: (savePath, dimension, regionX, regionZ, maxHeight) =>
    renderSaveRegion(savePath, dimension, regionX, regionZ, maxHeight),
}

setHandler(handler, getSerializedError)
