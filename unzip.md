# Unzip Module

[![npm version](https://img.shields.io/npm/v/@xmcl/unzip.svg)](https://www.npmjs.com/package/@xmcl/unzip)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/unzip.svg)](https://npmjs.com/@xmcl/unzip)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/unzip)](https://packagephobia.now.sh/result?p=@xmcl/unzip)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

A simple Unzipper wrapper for yauzl in nodejs.

Support `Promise` and nodejs `Stream`.

## Who might care this package

The people

1. who use nodejs
2. who want a unzip only interface
3. who think yauzl is good but its API is hard to use

might want to look at this.

## Where is the document

Since this is majorly used in its [parent project](https://github.com/voxelum/minecraft-launcher-core-node). You can

## 🏭 Functions

### filterEntries

```ts
filterEntries(zip: ZipFile, entries: (string | ((entry: Entry) => boolean))[]): Promise<(Entry | undefined)[]>
```
Walk all the entries of the zip and once provided entries are all found, then terminate the walk process
#### Parameters

- **zip**: `ZipFile`
The zip file
- **entries**: `(string | ((entry: Entry) => boolean))[]`
The entry to read
#### Return Type

- `Promise<(Entry | undefined)[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L202" target="_blank" rel="noreferrer">packages/unzip/index.ts:202</a>
</p>


### getEntriesRecord

```ts
getEntriesRecord(entries: Entry[]): Record<string, Entry>
```
#### Parameters

- **entries**: `Entry[]`
#### Return Type

- `Record<string, Entry>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L247" target="_blank" rel="noreferrer">packages/unzip/index.ts:247</a>
</p>


### open

```ts
open(target: OpenTarget, options: Options= ...): Promise<ZipFile>
```
Open a yauzl zip
#### Parameters

- **target**: `OpenTarget`
The zip path or buffer or file descriptor
- **options**: `Options`
The option to open
#### Return Type

- `Promise<ZipFile>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L15" target="_blank" rel="noreferrer">packages/unzip/index.ts:15</a>
</p>


### openEntryReadStream

```ts
openEntryReadStream(zip: ZipFile, entry: Entry, options: ZipFileOptions): Promise<Readable>
```
Open the entry readstream for the zip file
#### Parameters

- **zip**: `ZipFile`
The zip file object
- **entry**: `Entry`
The entry to open
- **options**: `ZipFileOptions`
The options to open stream
#### Return Type

- `Promise<Readable>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L53" target="_blank" rel="noreferrer">packages/unzip/index.ts:53</a>
</p>


### readAllEntries

```ts
readAllEntries(zipFile: ZipFile): Promise<Entry[]>
```
Walk all entries of the zip file
#### Parameters

- **zipFile**: `ZipFile`
The zip file object
#### Return Type

- `Promise<Entry[]>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L259" target="_blank" rel="noreferrer">packages/unzip/index.ts:259</a>
</p>


### readEntry

```ts
readEntry(zip: ZipFile, entry: Entry, options: ZipFileOptions): Promise<Buffer<ArrayBuffer>>
```
Read the entry to buffer
#### Parameters

- **zip**: `ZipFile`
The zip file object
- **entry**: `Entry`
The entry to open
- **options**: `ZipFileOptions`
The options to open stream
#### Return Type

- `Promise<Buffer<ArrayBuffer>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L76" target="_blank" rel="noreferrer">packages/unzip/index.ts:76</a>
</p>


### readEntryBuffered

```ts
readEntryBuffered(zip: ZipFile, entry: Entry): Promise<Buffer<ArrayBufferLike>>
```
Read an entry into a single ``Buffer`` using a positional read plus a
synchronous inflate, avoiding the per-entry ``ReadStream`` + zlib ``Transform``
pipeline that [readEntry](#readEntry) sets up. For the common case of many small
entries (block textures, models, lang files) this is several times faster.

Positional reads do not share a file cursor, so concurrent calls on the same
``zip`` are safe. Falls back to the streaming [readEntry](#readEntry) for encrypted
entries or compression methods other than store/deflate.
#### Parameters

- **zip**: `ZipFile`
The zip file object
- **entry**: `Entry`
The entry to read
#### Return Type

- `Promise<Buffer<ArrayBufferLike>>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L112" target="_blank" rel="noreferrer">packages/unzip/index.ts:112</a>
</p>


### walkEntries

```ts
walkEntries(zip: ZipFile, entryHandler: (entry: Entry) => boolean | void | Promise<boolean>): Promise<void>
```
Walk all the entries of a unread zip file
#### Parameters

- **zip**: `ZipFile`
The unread zip file
- **entryHandler**: `(entry: Entry) => boolean | void | Promise<boolean>`
The handler to recieve entries. Return true or Promise&lt;true&gt; to stop the walk
#### Return Type

- `Promise<void>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L234" target="_blank" rel="noreferrer">packages/unzip/index.ts:234</a>
</p>


### walkEntriesGenerator

```ts
walkEntriesGenerator(zip: ZipFile): AsyncGenerator<Entry, void, boolean | undefined>
```
Get the async entry generator for the zip file
#### Parameters

- **zip**: `ZipFile`
The zip file
#### Return Type

- `AsyncGenerator<Entry, void, boolean | undefined>`

<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L145" target="_blank" rel="noreferrer">packages/unzip/index.ts:145</a>
</p>



## ⏩ Type Aliases

### OpenTarget

```ts
OpenTarget: string | Buffer | number
```
<p style="font-size: 14px; color: var(--vp-c-text-2)">
<strong>Defined in:</strong> <a href="https://github.com/Voxelum/x-minecraft-launcher/blob/master/packages/unzip/index.ts#L8" target="_blank" rel="noreferrer">packages/unzip/index.ts:8</a>
</p>



