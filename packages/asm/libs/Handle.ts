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
 * A reference to a field or a method.
 *
 * @author Remi Forax
 * @author Eric Bruneton
 */
import { Opcodes } from './Opcodes'
export class Handle {
  /**
   * The kind of field or method designated by this Handle. Should be
   * {@link Opcodes#H_GETFIELD}, {@link Opcodes#H_GETSTATIC},
   * {@link Opcodes#H_PUTFIELD}, {@link Opcodes#H_PUTSTATIC},
   * {@link Opcodes#H_INVOKEVIRTUAL}, {@link Opcodes#H_INVOKESTATIC},
   * {@link Opcodes#H_INVOKESPECIAL}, {@link Opcodes#H_NEWINVOKESPECIAL} or
   * {@link Opcodes#H_INVOKEINTERFACE}.
   */
  readonly tag: number

  /**
   * The internal name of the class that owns the field or method designated
   * by this handle.
   */
  readonly owner: string

  /**
   * The name of the field or method designated by this handle.
   */
  readonly name: string

  /**
   * The descriptor of the field or method designated by this handle.
   */
  readonly descriptor: string

  /**
   * Indicate if the owner is an interface or not.
   */
  readonly isInterface: boolean

  /**
   * Constructs a new field or method handle.
   *
   * @param tag
   * the kind of field or method designated by this Handle. Must be
   * {@link Opcodes#H_GETFIELD}, {@link Opcodes#H_GETSTATIC},
   * {@link Opcodes#H_PUTFIELD}, {@link Opcodes#H_PUTSTATIC},
   * {@link Opcodes#H_INVOKEVIRTUAL},
   * {@link Opcodes#H_INVOKESTATIC},
   * {@link Opcodes#H_INVOKESPECIAL},
   * {@link Opcodes#H_NEWINVOKESPECIAL} or
   * {@link Opcodes#H_INVOKEINTERFACE}.
   * @param owner
   * the internal name of the class that owns the field or method
   * designated by this handle.
   * @param name
   * the name of the field or method designated by this handle.
   * @param desc
   * the descriptor of the field or method designated by this
   * handle.
   * @param itf
   * true if the owner is an interface.
   */
  public constructor(
    tag: number,
    owner: string,
    name: string,
    desc: string,
    itf: boolean = tag === Opcodes.H_INVOKEINTERFACE,
  ) {
    this.tag = tag
    this.owner = owner
    this.name = name
    this.descriptor = desc
    this.isInterface = itf
  }

  public equals(obj: any): boolean {
    if (obj === this) {
      return true
    }
    if (!(obj != null && obj instanceof Handle)) {
      return false
    }
    const h: Handle = obj
    return (
      this.tag === h.tag &&
      this.isInterface === h.isInterface &&
      this.owner === h.owner &&
      this.name === h.name &&
      this.descriptor === h.descriptor
    )
  }

  public hashCode(): number {
    return (
      this.tag +
      (this.isInterface ? 64 : 0) +
      <any>this.owner.toString() * <any>this.name.toString() * <any>this.descriptor.toString()
    )
  }

  /**
   * Returns the textual representation of this handle. The textual
   * representation is:
   *
   * <pre>
   * for a reference to a class:
   * owner '.' name desc ' ' '(' tag ')'
   * for a reference to an interface:
   * owner '.' name desc ' ' '(' tag ' ' itf ')'
   * </pre>
   *
   * . As this format is unambiguous, it can be parsed if necessary.
   */
  public toString(): string {
    return (
      this.owner +
      '.' +
      this.name +
      this.descriptor +
      ' (' +
      this.tag +
      (this.isInterface ? ' itf' : '') +
      ')'
    )
  }
}
