# ASM Module

[![npm version](https://img.shields.io/npm/v/@xmcl/asm.svg)](https://www.npmjs.com/package/@xmcl/asm)
[![Downloads](https://img.shields.io/npm/dm/@xmcl/asm.svg)](https://npmjs.com/@xmcl/asm)
[![Install size](https://packagephobia.now.sh/badge?p=@xmcl/asm)](https://packagephobia.now.sh/result?p=@xmcl/asm)
[![npm](https://img.shields.io/npm/l/@xmcl/minecraft-launcher-core.svg)](https://github.com/voxelum/minecraft-launcher-core-node/blob/master/LICENSE)
[![Build Status](https://github.com/voxelum/minecraft-launcher-core-node/workflows/Build/badge.svg)](https://github.com/Voxelum/minecraft-launcher-core-node/actions?query=workflow%3ABuild)

Parse Java bytecode, which port from [java asm package](https://asm.ow2.io/).

## Usage

### Visit java class in jar file

The usage is just like asm library in java:

```ts
import { AnnotationVisitor, ClassReader, ClassVisitor, MethodVisitor, Opcodes } from '@xmcl/asm'


class CustomClassVisitor extends ClassVisitor {
    public constructor() {
        super(Opcodes.ASM5);
    }

    // visit the class
    visit(version: number, access: number, name: string, signature: string, superName: string, interfaces: string[]): void {
    }

    // visit method
    public visitMethod(access: number, name: string, desc: string, signature: string, exceptions: string[]) {
        return null;
    }

    // visit field
    public visitField(access: number, name: string, desc: string, signature: string, value: any) {
        return null;
    }
}

const visitor = new CustomClassVisitor();
const classData: Buffer = await fs.readFile("path/to/some.class");
new ClassReader(classData).accept(visitor);
```
