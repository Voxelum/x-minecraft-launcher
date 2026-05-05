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
 * Information about a class being parsed in a {@link ClassReader}.
 *
 * @author Eric Bruneton
 */
import type { Label } from './Label'
import { TypePath } from './TypePath'
import { Attribute } from './Attribute'

export class Context {
  /**
   * Prototypes of the attributes that must be parsed for this class.
   */
  attrs: Attribute[]

  /**
   * The {@link ClassReader} option flags for the parsing of this class.
   */
  flags: number

  /**
   * The buffer used to read strings.
   */
  buffer: number[]

  /**
   * The start index of each bootstrap method.
   */
  bootstrapMethods: number[] = []

  /**
   * The access flags of the method currently being parsed.
   */
  access: number

  /**
   * The name of the method currently being parsed.
   */
  name = ''

  /**
   * The descriptor of the method currently being parsed.
   */
  desc = ''

  /**
   * The label objects, indexed by bytecode offset, of the method currently
   * being parsed (only bytecode offsets for which a label is needed have a
   * non null associated Label object).
   */
  labels: Label[] = []

  /**
   * The target of the type annotation currently being parsed.
   */
  typeRef: number

  /**
   * The path of the type annotation currently being parsed.
   */
  typePath: TypePath | null = null

  /**
   * The offset of the latest stack map frame that has been parsed.
   */
  offset: number

  /**
   * The labels corresponding to the start of the local variable ranges in the
   * local variable type annotation currently being parsed.
   */
  start: Label[] = []

  /**
   * The labels corresponding to the end of the local variable ranges in the
   * local variable type annotation currently being parsed.
   */
  end: Label[] = []

  /**
   * The local variable indices for each local variable range in the local
   * variable type annotation currently being parsed.
   */
  index: number[] = []

  /**
   * The encoding of the latest stack map frame that has been parsed.
   */
  mode: number

  /**
   * The number of locals in the latest stack map frame that has been parsed.
   */
  localCount: number

  /**
   * The number locals in the latest stack map frame that has been parsed,
   * minus the number of locals in the previous frame.
   */
  localDiff: number

  /**
   * The local values of the latest stack map frame that has been parsed.
   */
  local: any[] = []

  /**
   * The stack size of the latest stack map frame that has been parsed.
   */
  stackCount: number

  /**
   * The stack values of the latest stack map frame that has been parsed.
   */
  stack: any[] = []

  constructor(attrs: Attribute[], flags: number, buffer: number[]) {
    this.access = 0
    this.typeRef = 0
    this.offset = 0
    this.mode = 0
    this.localCount = 0
    this.localDiff = 0
    this.stackCount = 0
    this.attrs = attrs
    this.flags = flags
    this.buffer = buffer
  }
}
