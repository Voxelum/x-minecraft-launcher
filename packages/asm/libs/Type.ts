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
import { Opcodes } from './Opcodes'

/**
 * A Java field or method type. This class can be used to make it easier to
 * manipulate type and method descriptors.
 *
 * @author Eric Bruneton
 * @author Chris Nokleberg
 */
export class Type {
  /**
   * The sort of the <tt>void</tt> type. See {@link #getSort getSort}.
   */
  static readonly VOID: number = 0

  /**
   * The sort of the <tt>boolean</tt> type. See {@link #getSort getSort}.
   */
  static readonly BOOLEAN: number = 1

  /**
   * The sort of the <tt>char</tt> type. See {@link #getSort getSort}.
   */
  static readonly CHAR: number = 2

  /**
   * The sort of the <tt>byte</tt> type. See {@link #getSort getSort}.
   */
  static readonly BYTE: number = 3

  /**
   * The sort of the <tt>short</tt> type. See {@link #getSort getSort}.
   */
  static readonly SHORT: number = 4

  /**
   * The sort of the <tt>int</tt> type. See {@link #getSort getSort}.
   */
  static readonly INT: number = 5

  /**
   * The sort of the <tt>float</tt> type. See {@link #getSort getSort}.
   */
  static readonly FLOAT: number = 6

  /**
   * The sort of the <tt>long</tt> type. See {@link #getSort getSort}.
   */
  static readonly LONG: number = 7

  /**
   * The sort of the <tt>double</tt> type. See {@link #getSort getSort}.
   */
  static readonly DOUBLE: number = 8

  /**
   * The sort of array reference types. See {@link #getSort getSort}.
   */
  static readonly ARRAY: number = 9

  /**
   * The sort of object reference types. See {@link #getSort getSort}.
   */
  static readonly OBJECT: number = 10

  /**
   * The sort of method types. See {@link #getSort getSort}.
   */
  static readonly METHOD: number = 11

  /**
   * The <tt>void</tt> type.
   */
  static readonly VOID_TYPE: Type = new Type(
    Type.VOID,
    null,
    ('V'.charCodeAt(0) << 24) | (5 << 16),
    1,
  )

  /**
   * The <tt>boolean</tt> type.
   */
  static readonly BOOLEAN_TYPE: Type = new Type(
    Type.BOOLEAN,
    null,
    ('Z'.charCodeAt(0) << 24) | (5 << 8) | 1,
    1,
  )

  /**
   * The <tt>char</tt> type.
   */
  static readonly CHAR_TYPE: Type = new Type(
    Type.CHAR,
    null,
    ('C'.charCodeAt(0) << 24) | (6 << 8) | 1,
    1,
  )

  /**
   * The <tt>byte</tt> type.
   */
  static readonly BYTE_TYPE: Type = new Type(
    Type.BYTE,
    null,
    ('B'.charCodeAt(0) << 24) | (5 << 8) | 1,
    1,
  )

  /**
   * The <tt>short</tt> type.
   */
  static readonly SHORT_TYPE: Type = new Type(
    Type.SHORT,
    null,
    ('S'.charCodeAt(0) << 24) | (7 << 8) | 1,
    1,
  )

  /**
   * The <tt>int</tt> type.
   */
  static readonly INT_TYPE: Type = new Type(Type.INT, null, ('I'.charCodeAt(0) << 24) | 1, 1)

  /**
   * The <tt>float</tt> type.
   */
  static readonly FLOAT_TYPE: Type = new Type(
    Type.FLOAT,
    null,
    ('F'.charCodeAt(0) << 24) | (2 << 16) | (2 << 8) | 1,
    1,
  )

  /**
   * The <tt>long</tt> type.
   */
  static readonly LONG_TYPE: Type = new Type(
    Type.LONG,
    null,
    ('J'.charCodeAt(0) << 24) | (1 << 16) | (1 << 8) | 2,
    1,
  )

  /**
   * The <tt>double</tt> type.
   */
  static readonly DOUBLE_TYPE: Type = new Type(
    Type.DOUBLE,
    null,
    ('D'.charCodeAt(0) << 24) | (3 << 16) | (3 << 8) | 2,
    1,
  )

  /**
   * The sort of this Java type.
   *
   * {@link #VOID VOID}, {@link #BOOLEAN BOOLEAN}, {@link #CHAR CHAR},
   * {@link #BYTE BYTE}, {@link #SHORT SHORT}, {@link #INT INT},
   * {@link #FLOAT FLOAT}, {@link #LONG LONG}, {@link #DOUBLE DOUBLE},
   * {@link #ARRAY ARRAY}, {@link #OBJECT OBJECT} or {@link #METHOD
   * METHOD}.
   */
  readonly sort: number

  /**
   * A buffer containing the internal name of this Java type. This field is
   * only used for reference types.
   */
  private buf: string

  /**
   * The offset of the internal name of this Java type in {@link #buf buf} or,
   * for primitive types, the size, descriptor and getOpcode offsets for this
   * type (byte 0 contains the size, byte 1 the descriptor, byte 2 the offset
   * for IALOAD or IASTORE, byte 3 the offset for all other instructions).
   */
  private off: number

  /**
   * The length of the internal name of this Java type.
   */
  private len: number

  /**
   * Constructs a reference type.
   *
   * @param sort the sort of the reference type to be constructed.
   * @param buf  a buffer containing the descriptor of the previous type.
   * @param off  the offset of this descriptor in the previous buffer.
   * @param len  the length of this descriptor.
   */
  constructor(sort: number, buf: string | null, off: number, len: number) {
    this.sort = 0
    this.off = 0
    this.len = 0
    this.sort = sort
    this.buf = buf ?? ''
    this.off = off
    this.len = len
  }

  /**
   * Returns the Java type corresponding to the given internal name.
   *
   * @param internalName an internal name.
   * @return the Java type corresponding to the given internal name.
   */
  static getObjectType(internalName: string): Type {
    return new Type(
      internalName[0] === '[' ? Type.ARRAY : Type.OBJECT,
      internalName,
      0,
      internalName.length,
    )
  }

  /**
   * Returns the Java type corresponding to the given method descriptor.
   * Equivalent to <code>Type.getType(methodDescriptor)</code>.
   *
   * @param methodDescriptor a method descriptor.
   * @return the Java type corresponding to the given method descriptor.
   */
  static getMethodType(methodDescriptor: string): Type {
    return Type.getType(methodDescriptor, 0)
  }

  /**
   * Returns the Java types corresponding to the argument types of the given
   * method descriptor.
   *
   * @param methodDescriptor a method descriptor.
   * @return the Java types corresponding to the argument types of the given
   * method descriptor.
   */
  static getArgumentTypes(methodDescriptor: string): Type[] {
    let off = 1
    let size = 0
    while (true) {
      const car: string = methodDescriptor[off++]
      if (car === ')') {
        break
      } else if (car === 'L') {
        while (methodDescriptor[off++] !== ';') {}
        ++size
      } else if (car !== '[') {
        ++size
      }
    }
    const args: Type[] = new Array(size)
    off = 1
    size = 0
    while (methodDescriptor[off] !== ')') {
      args[size] = Type.getType(methodDescriptor, off)
      off += args[size].len + (args[size].sort === Type.OBJECT ? 2 : 0)
      size += 1
    }
    return args
  }

  /**
   * Computes the size of the arguments and of the return value of a method.
   *
   * @param desc the descriptor of a method.
   * @return the size of the arguments of the method (plus one for the
   * implicit this argument), argSize, and the size of its return
   * value, retSize, packed into a single int i =
   * <tt>(argSize &lt;&lt; 2) | retSize</tt> (argSize is therefore equal to
   * <tt>i &gt;&gt; 2</tt>, and retSize to <tt>i &amp; 0x03</tt>).
   */
  static getArgumentsAndReturnSizes(desc: string): number {
    let n = 1
    let c = 1
    while (true) {
      let car: string = desc.charAt(c++)
      if (car === ')') {
        car = desc.charAt(c)
        return (n << 2) | (car === 'V' ? 0 : car === 'D' || car === 'J' ? 2 : 1)
      } else if (car === 'L') {
        while (desc.charAt(c++) !== ';') {}
        n += 1
      } else if (car === '[') {
        while ((car = desc.charAt(c)) === '[') {
          ++c
        }
        if (car === 'D' || car === 'J') {
          n -= 1
        }
      } else if (car === 'D' || car === 'J') {
        n += 2
      } else {
        n += 1
      }
    }
    return 0
  }

  /**
   * Returns the Java type corresponding to the given type descriptor. For
   * method descriptors, buf is supposed to contain nothing more than the
   * descriptor itself.
   *
   * @param buf a buffer containing a type descriptor.
   * @param off the offset of this descriptor in the previous buffer.
   * @return the Java type corresponding to the given type descriptor.
   */
  static getType(str: string, off = 0): Type {
    let len: number
    const buf = ''.concat(str)
    switch (buf[off]) {
      case 'V':
        return Type.VOID_TYPE
      case 'Z':
        return Type.BOOLEAN_TYPE
      case 'C':
        return Type.CHAR_TYPE
      case 'B':
        return Type.BYTE_TYPE
      case 'S':
        return Type.SHORT_TYPE
      case 'I':
        return Type.INT_TYPE
      case 'F':
        return Type.FLOAT_TYPE
      case 'J':
        return Type.LONG_TYPE
      case 'D':
        return Type.DOUBLE_TYPE
      case '[':
        len = 1
        while (buf[off + len] === '[') {
          ++len
        }
        if (buf[off + len] === 'L') {
          ++len
          while (buf[off + len] !== ';') {
            ++len
          }
        }
        return new Type(Type.ARRAY, buf, off, len + 1)
      case 'L':
        len = 1
        while (buf[off + len] !== ';') {
          ++len
        }
        return new Type(Type.OBJECT, buf, off + 1, len - 1)
      default:
        return new Type(Type.METHOD, buf, off, buf.length - off)
    }
  }

  /**
   * Returns the internal name of the class corresponding to this object or
   * array type. The internal name of a class is its fully qualified name (as
   * returned by Class.getName(), where '.' are replaced by '/'. This method
   * should only be used for an object or array type.
   *
   * @return the internal name of the class corresponding to this object type.
   */
  get internalName(): string {
    return this.buf.substr(this.off, this.len)
  }

  /**
   * Appends the descriptor corresponding to this Java type to the given
   * string buffer.
   *
   * @param buf the string buffer to which the descriptor must be appended.
   */
  getDescriptor(buf: any = ''): any {
    if (this.sort == Type.OBJECT) {
      buf += 'L'
      for (let i = 0; i < this.len; i++) {
        buf += this.buf[i + this.off]
      }
      // buf.append(this.buf, off, len);
      buf += ';'
    } else {
      // sort == ARRAY || sort == METHOD
      for (let i = 0; i < this.len; i++) {
        buf += this.buf[i + this.off]
      }
      // buf.append(this.buf, this.off, this.len);
    }
  }

  /**
   * Returns the size of values of this type. This method must not be used for
   * method types.
   *
   * @return the size of values of this type, i.e., 2 for <tt>long</tt> and
   * <tt>double</tt>, 0 for <tt>void</tt> and 1 otherwise.
   */
  get size(): number {
    return this.buf == null ? this.off & 255 : 1
  }

  /**
   * Tests if the given object is equal to this type.
   *
   * @param o the object to be compared to this type.
   * @return <tt>true</tt> if the given object is equal to this type.
   */
  equals(o: any): boolean {
    if (this === o) {
      return true
    }
    if (!(o != null && o instanceof Type)) {
      return false
    }
    const t: Type = o
    if (this.sort !== t.sort) {
      return false
    }
    if (this.sort >= Type.ARRAY) {
      if (this.len !== t.len) {
        return false
      }
      for (
        let i: number = this.off, j: number = t.off, end: number = i + this.len;
        i < end;
        i++, j++
      ) {
        if (this.buf[i] !== t.buf[j]) {
          return false
        }
      }
    }
    return true
  }

  /**
   * Returns a hash code value for this type.
   *
   * @return a hash code value for this type.
   */
  hashCode(): number {
    let hc: number = 13 * this.sort
    if (this.sort >= Type.ARRAY) {
      for (let i: number = this.off, end: number = i + this.len; i < end; i++) {
        hc = 17 * (hc + this.buf[i].charCodeAt(0))
      }
    }
    return hc
  }

  /**
   * Returns a string representation of this type.
   *
   * @return the descriptor of this type.
   */
  toString(): string {
    return this.getDescriptor()
  }
}
