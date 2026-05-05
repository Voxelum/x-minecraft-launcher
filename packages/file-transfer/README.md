# Download Core

[![npm version](https://img.shields.io/npm/v/@xmcl/file-transfer.svg)](https://www.npmjs.com/package/@xmcl/file-transfer)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/file-transfer.svg)](https://npmjs.com/@xmcl/file-transfer)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/file-transfer)](https://packagephobia.now.sh/result?p=@xmcl/file-transfer)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Provide a high performance download file function based on [undici](https://github.com/nodejs/undici).

- Support download by range request
  - Customize the range size
- Support validating the checksum
  - If the validation matched, it won't download the file.
  - Also support customize validation.
- Support download and fallback to another url
- Support AbortSignal
- Fully customizable retry logic

## Usage

Download the file by url

```ts
import { download } from '@xmcl/file-transfer'

await download({
  url: 'http://example.com/file.zip', // required
  destination: 'file.zip', // required
  headers: { // optional
    'customized': 'header'
  },
  abortSignal: new AbortController().signal, // optional
  progressController: (url, chunkSize, progress, total) => { // optional
    console.log(url)
    console.log(chunkSize)
    console.log(progress)
    console.log(total)
  },
  // use validator to validate the file
  validator: { // optional
    algorithm: 'sha1',
    hash: '1234567890abcdef1234567890abcdef12345678',
  }
})
```

Download with fallback url

```ts
import { download } from '@xmcl/file-transfer'

await download({
  // using array to fallback
  url: ['http://example.com/file.zip', 'http://example.com/fallback.zip'],
  destination: 'file.zip',
})
```
