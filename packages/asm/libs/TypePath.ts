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
 * The path to a type argument, wildcard bound, array element type, or static
 * inner type within an enclosing type.
 *
 * @author Eric Bruneton
 */
import { ByteVector } from './ByteVector'

export class TypePath {
  /**
   * A type path step that steps into the element type of an array type. See
   * {@link #getStep getStep}.
   */
  public static ARRAY_ELEMENT = 0

  /**
   * A type path step that steps into the nested type of a class type. See
   * {@link #getStep getStep}.
   */
  public static INNER_TYPE = 1

  /**
   * A type path step that steps into the bound of a wildcard type. See
   * {@link #getStep getStep}.
   */
  public static WILDCARD_BOUND = 2

  /**
   * A type path step that steps into a type argument of a generic type. See
   * {@link #getStep getStep}.
   */
  public static TYPE_ARGUMENT = 3

  /**
   * The byte array where the path is stored, in Java class file format.
   */
  buf: Uint8Array

  /**
   * The offset of the first byte of the type path in 'b'.
   */
  offset: number

  /**
   * Creates a new type path.
   *
   * @param b
   * the byte array containing the type path in Java class file
   * format.
   * @param offset
   * the offset of the first byte of the type path in 'b'.
   */
  constructor(b: Uint8Array, offset: number) {
    this.offset = 0
    this.buf = b
    this.offset = offset
  }

  /**
   * Returns the length of this path.
   *
   * @return the length of this path.
   */
  get length(): number {
    return this.buf[this.offset]
  }

  /**
   * Returns the value of the given step of this path.
   *
   * @param index
   * an index between 0 and {@link #getLength()}, exclusive.
   * @return {@link #ARRAY_ELEMENT ARRAY_ELEMENT}, {@link #INNER_TYPE
   * INNER_TYPE}, {@link #WILDCARD_BOUND WILDCARD_BOUND}, or
   * {@link #TYPE_ARGUMENT TYPE_ARGUMENT}.
   */
  public getStep(index: number): number {
    return this.buf[this.offset + 2 * index + 1]
  }

  /**
   * Returns the index of the type argument that the given step is stepping
   * into. This method should only be used for steps whose value is
   * {@link #TYPE_ARGUMENT TYPE_ARGUMENT}.
   *
   * @param index
   * an index between 0 and {@link #getLength()}, exclusive.
   * @return the index of the type argument that the given step is stepping
   * into.
   */
  public getStepArgument(index: number): number {
    return this.buf[this.offset + 2 * index + 2]
  }

  /**
   * Converts a type path in string form, in the format used by
   * {@link #toString()}, into a TypePath object.
   *
   * @param typePath
   * a type path in string form, in the format used by
   * {@link #toString()}. May be null or empty.
   * @return the corresponding TypePath object, or null if the path is empty.
   */
  public static fromString(typePath: string): TypePath | null {
    if (typePath == null || typePath.length === 0) {
      return null
    }
    const n: number = typePath.length
    const out: ByteVector = new ByteVector(n)
    out.putByte(0)
    for (let i = 0; i < n; ) {
      let c: string = typePath.charAt(i++)
      if (c === '[') {
        out.put11(TypePath.ARRAY_ELEMENT, 0)
      } else if (c === '.') {
        out.put11(TypePath.INNER_TYPE, 0)
      } else if (c === '*') {
        out.put11(TypePath.WILDCARD_BOUND, 0)
      } else if (c.charCodeAt(0) >= '0'.charCodeAt(0) && c.charCodeAt(0) <= '9'.charCodeAt(0)) {
        let typeArg: number = c.charCodeAt(0) - '0'.charCodeAt(0)
        while (
          i < n &&
          (c = typePath.charAt(i)).charCodeAt(0) >= '0'.charCodeAt(0) &&
          c.charCodeAt(0) <= '9'.charCodeAt(0)
        ) {
          typeArg = typeArg * 10 + c.charCodeAt(0) - '0'.charCodeAt(0)
          i += 1
        }
        if (i < n && typePath.charAt(i) === ';') {
          i += 1
        }
        out.put11(TypePath.TYPE_ARGUMENT, typeArg)
      }
    }
    out.data[0] = (out.length / 2) | 0 | 0
    return new TypePath(out.data, 0)
  }

  /**
   * Returns a string representation of this type path. {@link #ARRAY_ELEMENT
   * ARRAY_ELEMENT} steps are represented with '[', {@link #INNER_TYPE
   * INNER_TYPE} steps with '.', {@link #WILDCARD_BOUND WILDCARD_BOUND} steps
   * with '*' and {@link #TYPE_ARGUMENT TYPE_ARGUMENT} steps with their type
   * argument index in decimal form followed by ';'.
   */
  public toString(): string {
    const length: number = this.length
    let result = ''
    for (let i = 0; i < length; ++i) {
      switch (this.getStep(i)) {
        case TypePath.ARRAY_ELEMENT:
          result += '['
          break
        case TypePath.INNER_TYPE:
          result += '.'
          break
        case TypePath.WILDCARD_BOUND:
          result += '*'
          break
        case TypePath.TYPE_ARGUMENT:
          result += this.getStepArgument(i) + ';'
          break
        default:
          result += '_'
      }
    }
    return result.toString()
  }
}
