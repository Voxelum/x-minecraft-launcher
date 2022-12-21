/* eslint-disable camelcase */
import { EncodingWorker } from '../entities/encodingWorker'
import { setHandler } from './helper'
import * as iconv from 'iconv-lite'
import 'source-map-support/register'

const AUTO_ENCODING_GUESS_MAX_BYTES = 512 * 128 // set an upper limit for the number of bytes we pass on to jschardet

const handler: EncodingWorker = {
  async decode(buffer: Buffer, encoding: string): Promise<string> {
    return iconv.decode(buffer, toNodeEncoding(encoding))
  },
  async guessEncodingByBuffer (buffer: Buffer): Promise<string | null> {
    const jschardet = await import('jschardet')

    const guessed = jschardet.detect(buffer.slice(0, AUTO_ENCODING_GUESS_MAX_BYTES)) // ensure to limit buffer for guessing due to https://github.com/aadsm/jschardet/issues/53
    if (!guessed || !guessed.encoding) {
      return null
    }

    return toIconvLiteEncoding(guessed.encoding)
  },
}

setHandler(handler)

const UTF8 = 'utf8'
const UTF8_with_bom = 'utf8bom'

function toNodeEncoding(enc: string | null): string {
  if (enc === UTF8_with_bom || enc === null) {
    return UTF8 // iconv does not distinguish UTF 8 with or without BOM, so we need to help it
  }

  return enc
}

const JSCHARDET_TO_ICONV_ENCODINGS: { [name: string]: string } = {
  ibm866: 'cp866',
  big5: 'cp950',
}

function toIconvLiteEncoding(encodingName: string): string {
  const normalizedEncodingName = encodingName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  const mapped = JSCHARDET_TO_ICONV_ENCODINGS[normalizedEncodingName]

  return mapped || normalizedEncodingName
}
