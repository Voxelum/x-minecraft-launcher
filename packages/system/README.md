# Common Module

[![npm version](https://img.shields.io/npm/v/@xmcl/system.svg)](https://www.npmjs.com/package/@xmcl/system)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/system.svg)](https://npmjs.com/@xmcl/system)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/system)](https://packagephobia.now.sh/result?p=@xmcl/system)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

A unified API to read directory or zip.

Support both nodejs and browser.

You can do read operations for zip or directory in same API:

```ts
import { openFileSystem } from "@xmcl/system";

let filePath = "/path/to/dir/"
const fs = await openFileSystem(filePath);
fs.readFile("a.txt"); // read /path/to/dir/a.txt

let zipPath = "/path/to/file.zip"
const fs = await openFileSystem(zipPath);
fs.readFile("a.txt"); // read a.txt in the file.zip!
```
