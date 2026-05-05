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
 * An {@link FieldVisitor} that generates Java fields in bytecode form.
 *
 * @author Eric Bruneton
 */
import { AnnotationVisitor } from './AnnotationVisitor'
import { AnnotationWriter } from './AnnotationWriter'
import { Attribute } from './Attribute'
import { ByteVector } from './ByteVector'
import { ANNOTATIONS, SIGNATURES } from './ClassReaderConstant'
import type { ClassWriter } from './ClassWriter'
import * as ClassWriterConstant from './ClassWriterConstant'
import { FieldVisitor } from './FieldVisitor'
import { Opcodes } from './Opcodes'
import { TypePath } from './TypePath'

export class FieldWriter extends FieldVisitor {
  /**
   * The class writer to which this field must be added.
   */
  private cw: ClassWriter

  /**
   * Access flags of this field.
   */
  private access: number

  /**
   * The index of the constant pool item that contains the name of this
   * method.
   */
  private name: number

  /**
   * The index of the constant pool item that contains the descriptor of this
   * field.
   */
  private desc: number

  /**
   * The index of the constant pool item that contains the signature of this
   * field.
   */
  private signature: number

  /**
   * The index of the constant pool item that contains the constant value of
   * this field.
   */
  private value: number

  /**
   * The runtime visible annotations of this field. May be <tt>null</tt>.
   */
  private anns!: AnnotationWriter

  /**
   * The runtime invisible annotations of this field. May be <tt>null</tt>.
   */
  private ianns!: AnnotationWriter

  /**
   * The runtime visible type annotations of this field. May be <tt>null</tt>.
   */
  private tanns!: AnnotationWriter

  /**
   * The runtime invisible type annotations of this field. May be
   * <tt>null</tt>.
   */
  private itanns!: AnnotationWriter

  /**
   * The non standard attributes of this field. May be <tt>null</tt>.
   */
  private attrs!: Attribute

  /**
   * Constructs a new {@link FieldWriter}.
   *
   * @param cw
   * the class writer to which this field must be added.
   * @param access
   * the field's access flags (see {@link Opcodes}).
   * @param name
   * the field's name.
   * @param desc
   * the field's descriptor (see {@link Type}).
   * @param signature
   * the field's signature. May be <tt>null</tt>.
   * @param value
   * the field's constant value. May be <tt>null</tt>.
   */
  constructor(
    cw: ClassWriter,
    access: number,
    name: string,
    desc: string,
    signature: string,
    value: any,
  ) {
    super(Opcodes.ASM5)
    this.access = 0
    this.name = 0
    this.desc = 0
    this.signature = 0
    this.value = 0
    if (cw.firstField == null) {
      cw.firstField = this
    } else {
      cw.lastField.fv = this
    }
    cw.lastField = this
    this.cw = cw
    this.access = access
    this.name = cw.newUTF8(name)
    this.desc = cw.newUTF8(desc)
    if (SIGNATURES && signature != null) {
      this.signature = cw.newUTF8(signature)
    }
    if (value != null) {
      this.value = cw.newConstItem(value).index
    }
  }

  public visitAnnotation(desc: string, visible: boolean): AnnotationVisitor | null {
    if (!ANNOTATIONS) {
      return null
    }
    const bv: ByteVector = new ByteVector()
    bv.putShort(this.cw.newUTF8(desc)).putShort(0)
    const aw: AnnotationWriter = new AnnotationWriter(this.cw, true, bv, bv, 2)
    if (visible) {
      aw.next = this.anns
      this.anns = aw
    } else {
      aw.next = this.ianns
      this.ianns = aw
    }
    return aw
  }

  public visitTypeAnnotation(
    typeRef: number,
    typePath: TypePath,
    desc: string,
    visible: boolean,
  ): AnnotationVisitor | null {
    if (!ANNOTATIONS) {
      return null
    }
    const bv: ByteVector = new ByteVector()
    AnnotationWriter.putTarget(typeRef, typePath, bv)
    bv.putShort(this.cw.newUTF8(desc)).putShort(0)
    const aw: AnnotationWriter = new AnnotationWriter(this.cw, true, bv, bv, bv.length - 2)
    if (visible) {
      aw.next = this.tanns
      this.tanns = aw
    } else {
      aw.next = this.itanns
      this.itanns = aw
    }
    return aw
  }

  public visitAttribute(attr: Attribute) {
    attr.next = this.attrs
    this.attrs = attr
  }

  public visitEnd() {}

  /**
   * Returns the size of this field.
   *
   * @return the size of this field.
   */
  getSize(): number {
    let size = 8
    if (this.value !== 0) {
      this.cw.newUTF8('ConstantValue')
      size += 8
    }
    if ((this.access & Opcodes.ACC_SYNTHETIC) !== 0) {
      if (
        (this.cw.version & 65535) < Opcodes.V1_5 ||
        (this.access & ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE) !== 0
      ) {
        this.cw.newUTF8('Synthetic')
        size += 6
      }
    }
    if ((this.access & Opcodes.ACC_DEPRECATED) !== 0) {
      this.cw.newUTF8('Deprecated')
      size += 6
    }
    if (SIGNATURES && this.signature !== 0) {
      this.cw.newUTF8('Signature')
      size += 8
    }
    if (ANNOTATIONS && this.anns != null) {
      this.cw.newUTF8('RuntimeVisibleAnnotations')
      size += 8 + this.anns.getSize()
    }
    if (ANNOTATIONS && this.ianns != null) {
      this.cw.newUTF8('RuntimeInvisibleAnnotations')
      size += 8 + this.ianns.getSize()
    }
    if (ANNOTATIONS && this.tanns != null) {
      this.cw.newUTF8('RuntimeVisibleTypeAnnotations')
      size += 8 + this.tanns.getSize()
    }
    if (ANNOTATIONS && this.itanns != null) {
      this.cw.newUTF8('RuntimeInvisibleTypeAnnotations')
      size += 8 + this.itanns.getSize()
    }
    if (this.attrs != null) {
      size += this.attrs.getSize(this.cw, null, 0, -1, -1)
    }
    return size
  }

  /**
   * Puts the content of this field into the given byte vector.
   *
   * @param out
   * where the content of this field must be put.
   */
  put(out: ByteVector) {
    const FACTOR: number = ClassWriterConstant.TO_ACC_SYNTHETIC_$LI$()
    const mask: number =
      Opcodes.ACC_DEPRECATED |
      ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE |
      (((this.access & ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE) / FACTOR) | 0)
    out
      .putShort(this.access & ~mask)
      .putShort(this.name)
      .putShort(this.desc)
    let attributeCount = 0
    if (this.value !== 0) {
      ++attributeCount
    }
    if ((this.access & Opcodes.ACC_SYNTHETIC) !== 0) {
      if (
        (this.cw.version & 65535) < Opcodes.V1_5 ||
        (this.access & ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE) !== 0
      ) {
        ++attributeCount
      }
    }
    if ((this.access & Opcodes.ACC_DEPRECATED) !== 0) {
      ++attributeCount
    }
    if (SIGNATURES && this.signature !== 0) {
      ++attributeCount
    }
    if (ANNOTATIONS && this.anns != null) {
      ++attributeCount
    }
    if (ANNOTATIONS && this.ianns != null) {
      ++attributeCount
    }
    if (ANNOTATIONS && this.tanns != null) {
      ++attributeCount
    }
    if (ANNOTATIONS && this.itanns != null) {
      ++attributeCount
    }
    if (this.attrs != null) {
      attributeCount += this.attrs.getCount()
    }
    out.putShort(attributeCount)
    if (this.value !== 0) {
      out.putShort(this.cw.newUTF8('ConstantValue'))
      out.putInt(2).putShort(this.value)
    }
    if ((this.access & Opcodes.ACC_SYNTHETIC) !== 0) {
      if (
        (this.cw.version & 65535) < Opcodes.V1_5 ||
        (this.access & ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE) !== 0
      ) {
        out.putShort(this.cw.newUTF8('Synthetic')).putInt(0)
      }
    }
    if ((this.access & Opcodes.ACC_DEPRECATED) !== 0) {
      out.putShort(this.cw.newUTF8('Deprecated')).putInt(0)
    }
    if (SIGNATURES && this.signature !== 0) {
      out.putShort(this.cw.newUTF8('Signature'))
      out.putInt(2).putShort(this.signature)
    }
    if (ANNOTATIONS && this.anns != null) {
      out.putShort(this.cw.newUTF8('RuntimeVisibleAnnotations'))
      this.anns.put(out)
    }
    if (ANNOTATIONS && this.ianns != null) {
      out.putShort(this.cw.newUTF8('RuntimeInvisibleAnnotations'))
      this.ianns.put(out)
    }
    if (ANNOTATIONS && this.tanns != null) {
      out.putShort(this.cw.newUTF8('RuntimeVisibleTypeAnnotations'))
      this.tanns.put(out)
    }
    if (ANNOTATIONS && this.itanns != null) {
      out.putShort(this.cw.newUTF8('RuntimeInvisibleTypeAnnotations'))
      this.itanns.put(out)
    }
    if (this.attrs != null) {
      this.attrs.put(this.cw, null, 0, -1, -1, out)
    }
  }
}
