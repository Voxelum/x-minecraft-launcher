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
 * A dynamically extensible vector of bytes. This class is roughly equivalent to
 * a DataOutputStream on top of a ByteArrayOutputStream, but is more efficient.
 *
 * @author Eric Bruneton
 */
export class ByteVector {
  /**
   * The content of this vector.
   */
  data: Uint8Array

  /**
   * Actual number of bytes in this vector.
   */
  length = 0

  /**
   * Constructs a new {@link ByteVector ByteVector} with the given initial
   * size.
   *
   * @param initialSize
   * the initial size of the byte vector to be constructed.
   */
  public constructor(initialSize = 64) {
    this.data = new Uint8Array(initialSize)
  }

  /**
   * Puts a byte into this byte vector. The byte vector is automatically
   * enlarged if necessary.
   *
   * @param b
   * a byte.
   * @return this byte vector.
   */
  public putByte(b: number): ByteVector {
    let length: number = this.length
    if (length + 1 > this.data.length) {
      this.enlarge(1)
    }
    this.data[length++] = b | 0
    this.length = length
    return this
  }

  /**
   * Puts two bytes into this byte vector. The byte vector is automatically
   * enlarged if necessary.
   *
   * @param b1
   * a byte.
   * @param b2
   * another byte.
   * @return this byte vector.
   */
  put11(b1: number, b2: number): ByteVector {
    let length: number = this.length
    if (length + 2 > this.data.length) {
      this.enlarge(2)
    }
    const data: Uint8Array = this.data
    data[length++] = b1 | 0
    data[length++] = b2 | 0
    this.length = length
    return this
  }

  /**
   * Puts a short into this byte vector. The byte vector is automatically
   * enlarged if necessary.
   *
   * @param s
   * a short.
   * @return this byte vector.
   */
  public putShort(s: number): ByteVector {
    let length: number = this.length
    if (length + 2 > this.data.length) {
      this.enlarge(2)
    }
    const data: Uint8Array = this.data
    data[length++] = (s >>> 8) | 0
    data[length++] = s | 0
    this.length = length
    return this
  }

  /**
   * Puts a byte and a short into this byte vector. The byte vector is
   * automatically enlarged if necessary.
   *
   * @param b a byte.
   * @param s a short.
   * @return this byte vector.
   */
  put12(b: number, s: number): ByteVector {
    let length: number = this.length
    if (length + 3 > this.data.length) {
      this.enlarge(3)
    }
    const data: Uint8Array = this.data
    data[length++] = b | 0
    data[length++] = (s >>> 8) | 0
    data[length++] = s | 0
    this.length = length
    return this
  }

  /**
   * Puts an int into this byte vector. The byte vector is automatically
   * enlarged if necessary.
   *
   * @param i
   * an int.
   * @return this byte vector.
   */
  public putInt(i: number): ByteVector {
    let length: number = this.length
    if (length + 4 > this.data.length) {
      this.enlarge(4)
    }
    const data: Uint8Array = this.data
    data[length++] = (i >>> 24) | 0
    data[length++] = (i >>> 16) | 0
    data[length++] = (i >>> 8) | 0
    data[length++] = i | 0
    this.length = length
    return this
  }

  /**
   * Puts a long into this byte vector. The byte vector is automatically
   * enlarged if necessary.
   *
   * @param l
   * a long.
   * @return this byte vector.
   */
  public putLong(l: bigint): ByteVector {
    let length: number = this.length
    if (length + 8 > this.data.length) {
      this.enlarge(8)
    }
    const data: Uint8Array = this.data
    let i = Number((l >> 32n) & 0xffffffffn)
    data[length++] = (i >>> 24) & 256
    data[length++] = (i >>> 16) & 256
    data[length++] = (i >>> 8) & 256
    data[length++] = i & 256
    i = Number(l & 0xffffffffn)
    data[length++] = (i >>> 24) & 256
    data[length++] = (i >>> 16) & 256
    data[length++] = (i >>> 8) & 256
    data[length++] = i & 256
    this.length = length
    return this
  }

  /**
   * Puts an UTF8 string into this byte vector. The byte vector is
   * automatically enlarged if necessary.
   *
   * @param s
   * a String whose UTF8 encoded length must be less than 65536.
   * @return this byte vector.
   */
  public putUTF8(s: string): ByteVector {
    const charLength: number = s.length
    if (charLength > 65535) {
      throw new Error()
    }
    let len: number = this.length
    if (len + 2 + charLength > this.data.length) {
      this.enlarge(2 + charLength)
    }
    const data: Uint8Array = this.data
    data[len++] = (charLength >>> 8) | 0
    data[len++] = charLength | 0
    for (let i = 0; i < charLength; ++i) {
      const c: string = s.charAt(i)
      if (c.charCodeAt(0) >= '\u0001'.charCodeAt(0) && c.charCodeAt(0) <= '\u007f'.charCodeAt(0)) {
        data[len++] = c.charCodeAt(0)
      } else {
        this.length = len
        return this.encodeUTF8(s, i, 65535)
      }
    }
    this.length = len
    return this
  }

  /**
   * Puts an UTF8 string into this byte vector. The byte vector is
   * automatically enlarged if necessary. The string length is encoded in two
   * bytes before the encoded characters, if there is space for that (i.e. if
   * this.length - i - 2 >= 0).
   *
   * @param s
   * the String to encode.
   * @param i
   * the index of the first character to encode. The previous
   * characters are supposed to have already been encoded, using
   * only one byte per character.
   * @param maxByteLength
   * the maximum byte length of the encoded string, including the
   * already encoded characters.
   * @return this byte vector.
   */
  encodeUTF8(s: string, i: number, maxByteLength: number): ByteVector {
    const charLength: number = s.length
    let byteLength: number = i
    let c: string
    for (let j: number = i; j < charLength; ++j) {
      c = s.charAt(j)
      if (c.charCodeAt(0) >= '\u0001'.charCodeAt(0) && c.charCodeAt(0) <= '\u007f'.charCodeAt(0)) {
        byteLength++
      } else if (c.charCodeAt(0) > '\u07ff'.charCodeAt(0)) {
        byteLength += 3
      } else {
        byteLength += 2
      }
    }
    if (byteLength > maxByteLength) {
      throw new Error()
    }
    const start: number = this.length - i - 2
    if (start >= 0) {
      this.data[start] = (byteLength >>> 8) | 0
      this.data[start + 1] = byteLength | 0
    }
    if (this.length + byteLength - i > this.data.length) {
      this.enlarge(byteLength - i)
    }
    let len: number = this.length
    for (let j: number = i; j < charLength; ++j) {
      c = s.charAt(j)
      if (c.charCodeAt(0) >= '\u0001'.charCodeAt(0) && c.charCodeAt(0) <= '\u007f'.charCodeAt(0)) {
        this.data[len++] = c.charCodeAt(0)
      } else if (c.charCodeAt(0) > '\u07ff'.charCodeAt(0)) {
        this.data[len++] = 224 | ((c.charCodeAt(0) >> 12) & 15) | 0
        this.data[len++] = 128 | ((c.charCodeAt(0) >> 6) & 63) | 0
        this.data[len++] = 128 | (c.charCodeAt(0) & 63) | 0
      } else {
        this.data[len++] = 192 | ((c.charCodeAt(0) >> 6) & 31) | 0
        this.data[len++] = 128 | (c.charCodeAt(0) & 63) | 0
      }
    }
    this.length = len
    return this
  }

  /**
   * Puts an array of bytes into this byte vector. The byte vector is
   * automatically enlarged if necessary.
   *
   * @param b
   * an array of bytes. May be <tt>null</tt> to put <tt>len</tt>
   * null bytes into this byte vector.
   * @param off
   * index of the fist byte of b that must be copied.
   * @param len
   * number of bytes of b that must be copied.
   * @return this byte vector.
   */
  public putByteArray(b: Uint8Array | null, off: number, len: number): ByteVector {
    if (this.length + len > this.data.length) {
      this.enlarge(len)
    }
    if (b != null) {
      for (let i = 0; i < len; i++) {
        this.data[i + this.length] = b[i + off]
      }
      // java.lang.System.arraycopy(b, off, this.data, this.length, len);
    }
    this.length += len
    return this
  }

  /**
   * Enlarge this byte vector so that it can receive n more bytes.
   *
   * @param size
   * number of additional bytes that this byte vector should be
   * able to receive.
   */
  private enlarge(size: number) {
    const length1: number = 2 * this.data.length
    const length2: number = this.length + size
    const newArr = new Uint8Array(length1 > length2 ? length1 : length2)
    newArr.set(this.data)
    this.data = newArr
  }
}
