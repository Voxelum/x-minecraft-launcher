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
 * A constant pool item. Constant pool items can be created with the 'newXXX'
 * methods in the {@link ClassWriter} class.
 *
 * @author Eric Bruneton
 */
import { ClassWriter } from './ClassWriter'
import * as ClassWriterConstant from './ClassWriterConstant'
import { floatToIntBits, doubleToLongBits } from './bits'
export class Item {
  /**
   * Index of this item in the constant pool.
   */
  index: number

  /**
   * Type of this constant pool item. A single class is used to represent all
   * constant pool item types, in order to minimize the bytecode size of this
   * package. The value of this field is one of {@link ClassWriter#INT},
   * {@link ClassWriter#LONG}, {@link ClassWriter#FLOAT},
   * {@link ClassWriter#DOUBLE}, {@link ClassWriter#UTF8},
   * {@link ClassWriter#STR}, {@link ClassWriter#CLASS},
   * {@link ClassWriter#NAME_TYPE}, {@link ClassWriter#FIELD},
   * {@link ClassWriter#METH}, {@link ClassWriter#IMETH},
   * {@link ClassWriter#MTYPE}, {@link ClassWriter#INDY}.
   *
   * MethodHandle constant 9 variations are stored using a range of 9 values
   * from {@link ClassWriter#HANDLE_BASE} + 1 to
   * {@link ClassWriter#HANDLE_BASE} + 9.
   *
   * Special Item types are used for Items that are stored in the ClassWriter
   * {@link ClassWriter#typeTable}, instead of the constant pool, in order to
   * avoid clashes with normal constant pool items in the ClassWriter constant
   * pool's hash table. These special item types are
   * {@link ClassWriter#TYPE_NORMAL}, {@link ClassWriter#TYPE_UNINIT} and
   * {@link ClassWriter#TYPE_MERGED}.
   */
  type!: number

  /**
   * Value of this item, for an integer item.
   */
  intVal = 0

  /**
   * Value of this item, for a long item.
   */
  longVal = 0n

  /**
   * First part of the value of this item, for items that do not hold a
   * primitive value.
   */
  strVal1 = ''

  /**
   * Second part of the value of this item, for items that do not hold a
   * primitive value.
   */
  strVal2 = ''

  /**
   * Third part of the value of this item, for items that do not hold a
   * primitive value.
   */
  strVal3 = ''

  /**
   * The hash code value of this constant pool item.
   */
  __hashCode!: number

  /**
   * Link to another constant pool item, used for collision lists in the
   * constant pool's hash table.
   */
  next: Item | null = null

  /**
   * Constructs a copy of the given item.
   *
   * @param index
   * index of the item to be constructed.
   * @param i
   * the item that must be copied into the item to be constructed.
   */
  public constructor(index: number, i?: Item) {
    this.index = index
    if (i) {
      this.index = index
      this.type = i.type
      this.intVal = i.intVal
      this.longVal = i.longVal
      this.strVal1 = i.strVal1
      this.strVal2 = i.strVal2
      this.strVal3 = i.strVal3
      this.__hashCode = i.__hashCode
    }
  }

  /**
   * Sets this item to an integer item.
   *
   * @param intVal
   * the value of this item.
   */
  set$int(intVal: number) {
    this.type = ClassWriterConstant.INT
    this.intVal = intVal
    this.__hashCode = 2147483647 & (this.type + intVal)
  }

  /**
   * Sets this item to a long item.
   *
   * @param longVal
   * the value of this item.
   */
  set$long(longVal: bigint) {
    this.type = ClassWriterConstant.LONG
    this.longVal = longVal
    this.__hashCode = 2147483647 & (this.type + Number(longVal & 0xffffffffn))
  }

  /**
   * Sets this item to a float item.
   *
   * @param floatVal
   * the value of this item.
   */
  set$float(floatVal: number) {
    this.type = ClassWriterConstant.FLOAT
    this.intVal = floatToIntBits(floatVal)
    this.__hashCode = 2147483647 & (this.type + (floatVal | 0))
  }

  /**
   * Sets this item to a double item.
   *
   * @param doubleVal
   * the value of this item.
   */
  set$double(doubleVal: number) {
    this.type = ClassWriterConstant.DOUBLE
    this.longVal = doubleToLongBits(doubleVal)
    this.__hashCode = 2147483647 & (this.type + (doubleVal | 0))
  }

  /**
   * Sets this item to an item that do not hold a primitive value.
   *
   * @param type
   * the type of this item.
   * @param strVal1
   * first part of the value of this item.
   * @param strVal2
   * second part of the value of this item.
   * @param strVal3
   * third part of the value of this item.
   */
  public set(type: number, strVal1?: string, strVal2?: string, strVal3?: string): any {
    this.type = type
    this.strVal1 = strVal1 ?? ''
    this.strVal2 = strVal2 ?? ''
    this.strVal3 = strVal3 ?? ''
    switch (type) {
      case ClassWriterConstant.CLASS:
        this.intVal = 0 // intVal of a class must be zero, see visitInnerClass
      // eslint-disable-next-line no-fallthrough
      case ClassWriterConstant.UTF8:
      case ClassWriterConstant.STR:
      case ClassWriterConstant.MTYPE:
      case ClassWriterConstant.TYPE_NORMAL:
        this.__hashCode = 0x7fffffff & (type + str_hash(this.strVal1))
        return
      case ClassWriterConstant.NAME_TYPE: {
        this.__hashCode = 0x7fffffff & (type + str_hash(this.strVal1) * str_hash(this.strVal2))
        return
      }
      // ClassWriterConstant.FIELD:
      // ClassWriterConstant.METH:
      // ClassWriterConstant.IMETH:
      // ClassWriterConstant.HANDLE_BASE + 1..9
      default:
        this.__hashCode =
          0x7fffffff &
          (type + str_hash(this.strVal1) * str_hash(this.strVal2) * str_hash(this.strVal3))
    }
  }

  /**
   * Sets the item to an InvokeDynamic item.
   *
   * @param name
   * invokedynamic's name.
   * @param desc
   * invokedynamic's desc.
   * @param bsmIndex
   * zero based index into the class attribute BootrapMethods.
   */
  setInvkDynItem(name: string, desc: string, bsmIndex: number) {
    this.type = ClassWriterConstant.INDY
    this.longVal = BigInt(bsmIndex)
    this.strVal1 = name
    this.strVal2 = desc
    this.__hashCode =
      2147483647 &
      (ClassWriterConstant.INDY +
        bsmIndex * <any>this.strVal1.toString() * <any>this.strVal2.toString())
  }

  /**
   * Sets the item to a BootstrapMethod item.
   *
   * @param position
   * position in byte in the class attribute BootrapMethods.
   * @param hashCode
   * hashcode of the item. This hashcode is processed from the
   * hashcode of the bootstrap method and the hashcode of all
   * bootstrap arguments.
   */
  setPosHash(position: number, hashCode: number) {
    this.type = ClassWriterConstant.BSM
    this.intVal = position
    this.__hashCode = hashCode
  }

  /**
   * Indicates if the given item is equal to this one. <i>This method assumes
   * that the two items have the same {@link #type}</i>.
   *
   * @param i
   * the item to be compared to this one. Both items must have the
   * same {@link #type}.
   * @return <tt>true</tt> if the given item if equal to this one,
   * <tt>false</tt> otherwise.
   */
  isEqualTo(i: Item): boolean {
    switch (this.type) {
      case ClassWriterConstant.UTF8:
      case ClassWriterConstant.STR:
      case ClassWriterConstant.CLASS:
      case ClassWriterConstant.MTYPE:
      case ClassWriterConstant.TYPE_NORMAL:
        return i.strVal1 === this.strVal1
      case ClassWriterConstant.TYPE_MERGED:
      case ClassWriterConstant.LONG:
      case ClassWriterConstant.DOUBLE:
        return i.longVal === this.longVal
      case ClassWriterConstant.INT:
      case ClassWriterConstant.FLOAT:
        return i.intVal === this.intVal
      case ClassWriterConstant.TYPE_UNINIT:
        return i.intVal === this.intVal && i.strVal1 === this.strVal1
      case ClassWriterConstant.NAME_TYPE:
        return i.strVal1 === this.strVal1 && i.strVal2 === this.strVal2
      case ClassWriterConstant.INDY: {
        return (
          i.longVal === this.longVal && i.strVal1 === this.strVal1 && i.strVal2 === this.strVal2
        )
      }
      default:
        return (
          i.strVal1 === this.strVal1 && i.strVal2 === this.strVal2 && i.strVal3 === this.strVal3
        )
    }
  }
}

function str_hash(str: string): number {
  let hash = 0
  if (str.length === 0) {
    return hash
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

// String.prototype["hashCode"] = function () {
//     let hash = 0;
//     if (this.length == 0) { return hash; }
//     for (let i = 0; i < this.length; i++) {
//         let char = this.charCodeAt(i);
//         hash = ((hash << 5) - hash) + char;
//         hash = hash & hash; // Convert to 32bit integer
//     }
//     return hash;
// }
