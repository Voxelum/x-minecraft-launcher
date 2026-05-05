/*
 * ASM: a very small and fast Java bytecode manipulation framework
 * Copyright (c) 2000-2011 INRIA, France Telecom
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holders nor the names of its
 *    contributors may be used to endorse or promote products derived from
 *    this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */

/* Generated from Java with JSweet 1.2.0-SNAPSHOT - http://www.jsweet.org */
/**
 * An {@link AnnotationVisitor} that generates annotations in bytecode form.
 *
 * @author Eric Bruneton
 * @author Eugene Kuleshov
 */

import type { ClassWriter } from './ClassWriter'
import { AnnotationVisitor } from './AnnotationVisitor'
import type { ByteVector } from './ByteVector'
import { Opcodes } from './Opcodes'
import type { Item } from './Item'
import type { TypePath } from './TypePath'
import { Type } from './Type'

export class AnnotationWriter extends AnnotationVisitor {
  /**
   * The class writer TO which this annotation must be added.
   */
  private cw: ClassWriter

  /**
   * The number of values in this annotation.
   */
  private size: number

  /**
   * <tt>true<tt> if values are named, <tt>false</tt> otherwise. Annotation
   * writers used for annotation default and annotation arrays use unnamed
   * values.
   */
  private named: boolean

  /**
   * The annotation values in bytecode form. This byte vector only contains
   * the values themselves, i.e. the number of values must be stored as a
   * unsigned short just before these bytes.
   */
  private bv: ByteVector

  /**
   * The byte vector to be used to store the number of values of this
   * annotation. See {@link #bv}.
   */
  private parent: ByteVector | null

  /**
   * Where the number of values of this annotation must be stored in
   * {@link #parent}.
   */
  private offset: number

  /**
   * Next annotation writer. This field is used to store annotation lists.
   */
  next: AnnotationWriter | null = null

  /**
   * Previous annotation writer. This field is used to store annotation lists.
   */
  prev: AnnotationWriter | null = null

  /**
   * Constructs a new {@link AnnotationWriter}.
   *
   * @param cw
   * the class writer to which this annotation must be added.
   * @param named
   * <tt>true<tt> if values are named, <tt>false</tt> otherwise.
   * @param bv
   * where the annotation values must be stored.
   * @param parent
   * where the number of annotation values must be stored.
   * @param offset
   * where in <tt>parent</tt> the number of annotation values must
   * be stored.
   */
  constructor(
    cw: ClassWriter,
    named: boolean,
    bv: ByteVector,
    parent: ByteVector | null = null,
    offset: number,
  ) {
    super(Opcodes.ASM5)
    this.size = 0
    this.named = false
    this.offset = 0
    this.cw = cw
    this.named = named
    this.bv = bv
    this.parent = parent
    this.offset = offset
  }

  public visit(name: string, value: any) {
    ++this.size
    if (this.named) {
      this.bv.putShort(this.cw.newUTF8(name))
    }
    if (typeof value === 'string') {
      this.bv.put12('s'.charCodeAt(0), this.cw.newUTF8(value))
    } else if (typeof value === 'number') {
      this.bv.put12('B'.charCodeAt(0), this.cw.newInteger(value).index)
    } else if (typeof value === 'boolean') {
      const v: number = value ? 1 : 0
      this.bv.put12('Z'.charCodeAt(0), this.cw.newInteger(v).index)
    } else if (typeof value === 'string') {
      this.bv.put12('C'.charCodeAt(0), this.cw.newInteger(value.charCodeAt(0)).index)
    } else if (typeof value === 'number') {
      this.bv.put12('S'.charCodeAt(0), this.cw.newInteger(value).index)
    } else if (value != null && value instanceof Type) {
      this.bv.put12('c'.charCodeAt(0), this.cw.newUTF8(value.getDescriptor()))
    } else if (value != null && value instanceof Array) {
      const v: number[] = value as number[]
      this.bv.put12('['.charCodeAt(0), v.length)
      for (let i = 0; i < v.length; i++) {
        this.bv.put12('B'.charCodeAt(0), this.cw.newInteger(v[i]).index)
      }
    } else if (value != null && value instanceof Array) {
      const v: boolean[] = <boolean[]>value
      this.bv.put12('['.charCodeAt(0), v.length)
      for (let i = 0; i < v.length; i++) {
        this.bv.put12('Z'.charCodeAt(0), this.cw.newInteger(v[i] ? 1 : 0).index)
      }
    } else if (value != null && value instanceof Array) {
      const v: number[] = value as number[]
      this.bv.put12('['.charCodeAt(0), v.length)
      for (let i = 0; i < v.length; i++) {
        this.bv.put12('S'.charCodeAt(0), this.cw.newInteger(v[i]).index)
      }
    } else if (value != null && value instanceof Array) {
      const v: string[] = <string[]>value
      this.bv.put12('['.charCodeAt(0), v.length)
      for (let i = 0; i < v.length; i++) {
        this.bv.put12('C'.charCodeAt(0), this.cw.newInteger(v[i].charCodeAt(0)).index)
      }
    } else if (value != null && value instanceof Array) {
      const v: number[] = value as number[]
      this.bv.put12('['.charCodeAt(0), v.length)
      for (let i = 0; i < v.length; i++) {
        this.bv.put12('I'.charCodeAt(0), this.cw.newInteger(v[i]).index)
      }
    } else if (value != null && value instanceof Array) {
      const v: number[] = value as number[]
      this.bv.put12('['.charCodeAt(0), v.length)
      for (let i = 0; i < v.length; i++) {
        // break...
        // this.bv.put12(('J').charCodeAt(0), this.cw.newLong(v[i]).index);
      }
    } else if (value != null && value instanceof Array) {
      const v: number[] = value as number[]
      this.bv.put12('['.charCodeAt(0), v.length)
      for (let i = 0; i < v.length; i++) {
        this.bv.put12('F'.charCodeAt(0), this.cw.newFloat(v[i]).index)
      }
    } else if (value != null && value instanceof Array) {
      const v: number[] = value as number[]
      this.bv.put12('['.charCodeAt(0), v.length)
      for (let i = 0; i < v.length; i++) {
        this.bv.put12('D'.charCodeAt(0), this.cw.newDouble(v[i]).index)
      }
    } else {
      const i: Item = this.cw.newConstItem(value)
      this.bv.put12('.s.IFJDCS'.charAt(i.type).charCodeAt(0), i.index)
    }
  }

  public visitEnum(name: string, desc: string, value: string) {
    ++this.size
    if (this.named) {
      this.bv.putShort(this.cw.newUTF8(name))
    }
    this.bv.put12('e'.charCodeAt(0), this.cw.newUTF8(desc)).putShort(this.cw.newUTF8(value))
  }

  public visitAnnotation(name: string, desc: string): AnnotationVisitor {
    ++this.size
    if (this.named) {
      this.bv.putShort(this.cw.newUTF8(name))
    }
    this.bv.put12('@'.charCodeAt(0), this.cw.newUTF8(desc)).putShort(0)
    return new AnnotationWriter(this.cw, true, this.bv, this.bv, this.bv.length - 2)
  }

  public visitArray(name: string): AnnotationVisitor {
    ++this.size
    if (this.named) {
      this.bv.putShort(this.cw.newUTF8(name))
    }
    this.bv.put12('['.charCodeAt(0), 0)
    return new AnnotationWriter(this.cw, false, this.bv, this.bv, this.bv.length - 2)
  }

  public visitEnd() {
    if (this.parent != null) {
      const data: Uint8Array = this.parent.data
      data[this.offset] = (this.size >>> 8) | 0
      data[this.offset + 1] = this.size | 0
    }
  }

  /**
   * Returns the size of this annotation writer list.
   *
   * @return the size of this annotation writer list.
   */
  getSize(): number {
    let size = 0
    let aw: AnnotationWriter | null = this
    while (aw != null) {
      size += aw.bv.length
      aw = aw.next
    }
    return size
  }

  /**
   * Puts the annotations of this annotation writer list into the given byte
   * vector.
   *
   * @param out
   * where the annotations must be put.
   */
  put(out: ByteVector) {
    let n = 0
    let size = 2
    let aw: AnnotationWriter | null = this
    let last: AnnotationWriter | null = null
    while (aw != null) {
      ++n
      size += aw.bv.length
      aw.visitEnd()
      aw.prev = last
      last = aw
      aw = aw.next
    }
    out.putInt(size)
    out.putShort(n)
    aw = last
    while (aw != null) {
      out.putByteArray(aw.bv.data, 0, aw.bv.length)
      aw = aw.prev
    }
  }

  /**
   * Puts the given annotation lists into the given byte vector.
   *
   * @param panns
   * an array of annotation writer lists.
   * @param off
   * index of the first annotation to be written.
   * @param out
   * where the annotations must be put.
   */
  static put(panns: AnnotationWriter[], off: number, out: ByteVector) {
    let size: number = 1 + 2 * (panns.length - off)
    for (let i: number = off; i < panns.length; ++i) {
      size += panns[i] == null ? 0 : panns[i].getSize()
    }
    out.putInt(size).putByte(panns.length - off)
    for (let i: number = off; i < panns.length; ++i) {
      let aw: AnnotationWriter | null = panns[i]
      let last: AnnotationWriter | null = null
      let n = 0
      while (aw != null) {
        ++n
        aw.visitEnd()
        aw.prev = last
        last = aw
        aw = aw.next
      }
      out.putShort(n)
      aw = last
      while (aw != null) {
        out.putByteArray(aw.bv.data, 0, aw.bv.length)
        aw = aw.prev
      }
    }
  }

  /**
   * Puts the given type reference and type path into the given bytevector.
   * LOCAL_VARIABLE and RESOURCE_VARIABLE target types are not supported.
   *
   * @param typeRef
   * a reference to the annotated type. See {@link TypeReference}.
   * @param typePath
   * the path to the annotated type argument, wildcard bound, array
   * element type, or static inner type within 'typeRef'. May be
   * <tt>null</tt> if the annotation targets 'typeRef' as a whole.
   * @param out
   * where the type reference and type path must be put.
   */
  static putTarget(typeRef: number, typePath: TypePath, out: ByteVector) {
    switch (typeRef >>> 24) {
      case 0:
      case 1:
      case 22:
        out.putShort(typeRef >>> 16)
        break
      case 19:
      case 20:
      case 21:
        out.putByte(typeRef >>> 24)
        break
      case 71:
      case 72:
      case 73:
      case 74:
      case 75:
        out.putInt(typeRef)
        break
      default:
        out.put12(typeRef >>> 24, (typeRef & 16776960) >> 8)
        break
    }
    if (typePath == null) {
      out.putByte(0)
    } else {
      const length: number = typePath.buf[typePath.offset] * 2 + 1
      out.putByteArray(typePath.buf, typePath.offset, length)
    }
  }
}
