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
 * Information about the input and output stack map frames of a basic block.
 *
 * @author Eric Bruneton
 */
import type { ClassWriter } from './ClassWriter'
import * as ClassWriterConstant from './ClassWriterConstant'
import type { Item } from './Item'
import type { Label } from './Label'
import { ACC_CONSTRUCTOR } from './MethodWriterConstant'
import { Opcodes } from './Opcodes'
import { Type } from './Type'
import { assert } from './utils'

function isClassWriter(cw: unknown): cw is ClassWriter {
  return cw != null && cw instanceof Object && 'addType' in cw && 'addUninitializedType' in cw
}

export class Frame {
  /**
   * Mask to get the dimension of a frame type. This dimension is a signed
   * integer between -8 and 7.
   */
  static DIM = -268435456

  /**
   * Constant to be added to a type to get a type with one more dimension.
   */
  static ARRAY_OF = 268435456

  /**
   * Constant to be added to a type to get a type with one less dimension.
   */
  static ELEMENT_OF = -268435456

  /**
   * Mask to get the kind of a frame type.
   *
   * @see #BASE
   * @see #LOCAL
   * @see #STACK
   */
  static KIND = 251658240

  /**
   * Flag used for LOCAL and STACK types. Indicates that if this type happens
   * to be a long or double type (during the computations of input frames),
   * then it must be set to TOP because the second word of this value has been
   * reused to store other data in the basic block. Hence the first word no
   * longer stores a valid long or double value.
   */
  static TOP_IF_LONG_OR_DOUBLE = 8388608

  /**
   * Mask to get the value of a frame type.
   */
  static VALUE = 8388607

  /**
   * Mask to get the kind of base types.
   */
  static BASE_KIND = 267386880

  /**
   * Mask to get the value of base types.
   */
  static BASE_VALUE = 1048575

  /**
   * Kind of the types that are not relative to an input stack map frame.
   */
  static BASE = 16777216

  /**
   * Base kind of the base reference types. The BASE_VALUE of such types is an
   * index into the type table.
   */
  static OBJECT: number = Frame.BASE | 7340032

  public static OBJECT_$LI$(): number {
    return Frame.OBJECT
  }

  /**
   * Base kind of the uninitialized base types. The BASE_VALUE of such types
   * in an index into the type table (the Item at that index contains both an
   * instruction offset and an internal class name).
   */
  static UNINITIALIZED: number = Frame.BASE | 8388608

  public static UNINITIALIZED_$LI$(): number {
    return Frame.UNINITIALIZED
  }

  /**
   * Kind of the types that are relative to the local variable types of an
   * input stack map frame. The value of such types is a local variable index.
   */
  static LOCAL = 33554432

  /**
   * Kind of the the types that are relative to the stack of an input stack
   * map frame. The value of such types is a position relatively to the top of
   * this stack.
   */
  static STACK = 50331648

  /**
   * The TOP type. This is a BASE type.
   */
  static TOP: number

  public static TOP_$LI$(): number {
    if (Frame.TOP == null) {
      Frame.TOP = Frame.BASE | 0
    }
    return Frame.TOP
  }

  /**
   * The BOOLEAN type. This is a BASE type mainly used for array types.
   */
  static BOOLEAN: number

  public static BOOLEAN_$LI$(): number {
    if (Frame.BOOLEAN == null) {
      Frame.BOOLEAN = Frame.BASE | 9
    }
    return Frame.BOOLEAN
  }

  /**
   * The BYTE type. This is a BASE type mainly used for array types.
   */
  static BYTE: number

  public static BYTE_$LI$(): number {
    if (Frame.BYTE == null) {
      Frame.BYTE = Frame.BASE | 10
    }
    return Frame.BYTE
  }

  /**
   * The CHAR type. This is a BASE type mainly used for array types.
   */
  static CHAR: number

  public static CHAR_$LI$(): number {
    if (Frame.CHAR == null) {
      Frame.CHAR = Frame.BASE | 11
    }
    return Frame.CHAR
  }

  /**
   * The SHORT type. This is a BASE type mainly used for array types.
   */
  static SHORT: number

  public static SHORT_$LI$(): number {
    if (Frame.SHORT == null) {
      Frame.SHORT = Frame.BASE | 12
    }
    return Frame.SHORT
  }

  /**
   * The INTEGER type. This is a BASE type.
   */
  static INTEGER: number

  public static INTEGER_$LI$(): number {
    if (Frame.INTEGER == null) {
      Frame.INTEGER = Frame.BASE | 1
    }
    return Frame.INTEGER
  }

  /**
   * The FLOAT type. This is a BASE type.
   */
  static FLOAT: number

  public static FLOAT_$LI$(): number {
    if (Frame.FLOAT == null) {
      Frame.FLOAT = Frame.BASE | 2
    }
    return Frame.FLOAT
  }

  /**
   * The DOUBLE type. This is a BASE type.
   */
  static DOUBLE: number

  public static DOUBLE_$LI$(): number {
    if (Frame.DOUBLE == null) {
      Frame.DOUBLE = Frame.BASE | 3
    }
    return Frame.DOUBLE
  }

  /**
   * The LONG type. This is a BASE type.
   */
  static LONG: number

  public static LONG_$LI$(): number {
    if (Frame.LONG == null) {
      Frame.LONG = Frame.BASE | 4
    }
    return Frame.LONG
  }

  /**
   * The NULL type. This is a BASE type.
   */
  static NULL: number

  public static NULL_$LI$(): number {
    if (Frame.NULL == null) {
      Frame.NULL = Frame.BASE | 5
    }
    return Frame.NULL
  }

  /**
   * The UNINITIALIZED_THIS type. This is a BASE type.
   */
  static UNINITIALIZED_THIS: number

  public static UNINITIALIZED_THIS_$LI$(): number {
    if (Frame.UNINITIALIZED_THIS == null) {
      Frame.UNINITIALIZED_THIS = Frame.BASE | 6
    }
    return Frame.UNINITIALIZED_THIS
  }

  /**
   * The stack size variation corresponding to each JVM instruction. This
   * stack variation is equal to the size of the values produced by an
   * instruction, minus the size of the values consumed by this instruction.
   */
  static SIZE: number[] = (() => {
    let i: number
    const b: number[] = new Array(202)
    const s =
      'EFFFFFFFFGGFFFGGFFFEEFGFGFEEEEEEEEEEEEEEEEEEEEDEDEDDDDDCDCDEEEEEEEEEEEEEEEEEEEEBABABBBBDCFFFGGGEDCDCDCDCDCDCDCDCDCDCEEEEDDDDDDDCDCDCEFEFDDEEFFDEDEEEBDDBBDDDDDDCCCCCCCCEFEDDDCDCDEEEEEEEEEEFEEEEEEDDEEDDEE'
    for (i = 0; i < b.length; ++i) {
      b[i] = s.charAt(i).charCodeAt(0) - 'E'.charCodeAt(0)
    }
    return b
  })()

  public static SIZE_$LI$(): number[] {
    return Frame.SIZE
  }

  static __static_initializer_0() {
    let i: number
    const b: number[] = new Array(202)
    const s =
      'EFFFFFFFFGGFFFGGFFFEEFGFGFEEEEEEEEEEEEEEEEEEEEDEDEDDDDDCDCDEEEEEEEEEEEEEEEEEEEEBABABBBBDCFFFGGGEDCDCDCDCDCDCDCDCDCDCEEEEDDDDDDDCDCDCEFEFDDEEFFDEDEEEBDDBBDDDDDDCCCCCCCCEFEDDDCDCDEEEEEEEEEEFEEEEEEDDEEDDEE'
    for (i = 0; i < b.length; ++i) {
      b[i] = s.charAt(i).charCodeAt(0) - 'E'.charCodeAt(0)
    }
    Frame.SIZE = b
  }

  /**
   * The label (i.e. basic block) to which these input and output stack map
   * frames correspond.
   */
  owner: Label

  /**
   * The input stack map frame locals.
   */
  inputLocals: number[] = []

  /**
   * The input stack map frame stack.
   */
  inputStack: number[] = []

  /**
   * The output stack map frame locals.
   */
  private outputLocals: number[] = []

  /**
   * The output stack map frame stack.
   */
  private outputStack: number[] = []

  /**
   * Relative size of the output stack. The exact semantics of this field
   * depends on the algorithm that is used.
   *
   * When only the maximum stack size is computed, this field is the size of
   * the output stack relatively to the top of the input stack.
   *
   * When the stack map frames are completely computed, this field is the
   * actual number of types in {@link #outputStack}.
   */
  outputStackTop: number

  /**
   * Number of types that are initialized in the basic block.
   *
   * @see #initializations
   */
  private initializationCount: number

  /**
   * The types that are initialized in the basic block. A constructor
   * invocation on an UNINITIALIZED or UNINITIALIZED_THIS type must replace
   * <i>every occurence</i> of this type in the local variables and in the
   * operand stack. This cannot be done during the first phase of the
   * algorithm since, during this phase, the local variables and the operand
   * stack are not completely computed. It is therefore necessary to store the
   * types on which constructors are invoked in the basic block, in order to
   * do this replacement during the second phase of the algorithm, where the
   * frames are fully computed. Note that this array can contain types that
   * are relative to input locals or to the input stack (see below for the
   * description of the algorithm).
   */
  private initializations: number[] | null = null

  /**
   * Sets this frame to the given value.
   *
   * @param cw
   * the ClassWriter to which this label belongs.
   * @param nLocal
   * the number of local variables.
   * @param local
   * the local variable types. Primitive types are represented by
   * {@link Opcodes#TOP}, {@link Opcodes#INTEGER},
   * {@link Opcodes#FLOAT}, {@link Opcodes#LONG},
   * {@link Opcodes#DOUBLE},{@link Opcodes#NULL} or
   * {@link Opcodes#UNINITIALIZED_THIS} (long and double are
   * represented by a single element). Reference types are
   * represented by String objects (representing internal names),
   * and uninitialized types by Label objects (this label
   * designates the NEW instruction that created this uninitialized
   * value).
   * @param nStack
   * the number of operand stack elements.
   * @param stack
   * the operand stack types (same format as the "local" array).
   */
  public set(cw?: any, nLocal?: any, local?: any, nStack?: any, stack?: any): any {
    if (
      ((cw != null && cw instanceof Object && 'addType' in cw && 'addUninitializedType' in cw) ||
        cw === null) &&
      (typeof nLocal === 'number' || nLocal === null) &&
      ((local != null && local instanceof Array) || local === null) &&
      (typeof nStack === 'number' || nStack === null) &&
      ((stack != null && stack instanceof Array) || stack === null)
    ) {
      const __args = Array.prototype.slice.call(arguments)
      return <any>(() => {
        let i: number = Frame.convert(cw, nLocal, local, this.inputLocals)
        while (i < local.length) {
          this.inputLocals[i++] = Frame.TOP_$LI$()
        }
        let nStackTop = 0
        for (let j = 0; j < nStack; ++j) {
          if (stack[j] === Opcodes.LONG || stack[j] === Opcodes.DOUBLE) {
            ++nStackTop
          }
        }
        this.inputStack = new Array(nStack + nStackTop)
        Frame.convert(cw, nStack, stack, this.inputStack)
        this.outputStackTop = 0
        this.initializationCount = 0
      })()
    } else if (
      (typeof cw === 'number' || cw === null) &&
      (typeof nLocal === 'number' || nLocal === null) &&
      local === undefined &&
      nStack === undefined &&
      stack === undefined
    ) {
      return <any>this.set$int$int(cw, nLocal)
    } else if (
      ((cw != null && cw instanceof Frame) || cw === null) &&
      nLocal === undefined &&
      local === undefined &&
      nStack === undefined &&
      stack === undefined
    ) {
      return <any>this.set$Frame(cw)
    } else {
      throw new Error('invalid overload')
    }
  }

  /**
   * Converts types from the MethodWriter.visitFrame() format to the Frame
   * format.
   *
   * @param cw
   * the ClassWriter to which this label belongs.
   * @param nInput
   * the number of types to convert.
   * @param input
   * the types to convert. Primitive types are represented by
   * {@link Opcodes#TOP}, {@link Opcodes#INTEGER},
   * {@link Opcodes#FLOAT}, {@link Opcodes#LONG},
   * {@link Opcodes#DOUBLE},{@link Opcodes#NULL} or
   * {@link Opcodes#UNINITIALIZED_THIS} (long and double are
   * represented by a single element). Reference types are
   * represented by String objects (representing internal names),
   * and uninitialized types by Label objects (this label
   * designates the NEW instruction that created this uninitialized
   * value).
   * @param output
   * where to store the converted types.
   * @return the number of output elements.
   */
  private static convert(cw: ClassWriter, nInput: number, input: any[], output: number[]): number {
    let i = 0
    for (let j = 0; j < nInput; ++j) {
      if (typeof input[j] === 'number') {
        output[i++] = Frame.BASE | /* intValue */ (<number>input[j] | 0)
        if (input[j] === Opcodes.LONG || input[j] === Opcodes.DOUBLE) {
          output[i++] = Frame.TOP_$LI$()
        }
      } else if (typeof input[j] === 'string') {
        output[i++] = Frame.type(cw, Type.getObjectType(<string>input[j]).getDescriptor())
      } else {
        output[i++] =
          Frame.UNINITIALIZED_$LI$() | cw.addUninitializedType('', (<Label>input[j]).position)
      }
    }
    return i
  }

  /**
   * Sets this frame to the value of the given frame. WARNING: after this
   * method is called the two frames share the same data structures. It is
   * recommended to discard the given frame f to avoid unexpected side
   * effects.
   *
   * @param f
   * The new frame value.
   */
  set$Frame(f: Frame) {
    this.inputLocals = f.inputLocals
    this.inputStack = f.inputStack
    this.outputLocals = f.outputLocals
    this.outputStack = f.outputStack
    this.outputStackTop = f.outputStackTop
    this.initializationCount = f.initializationCount
    this.initializations = f.initializations
  }

  /**
   * Returns the output frame local variable type at the given index.
   *
   * @param local
   * the index of the local that must be returned.
   * @return the output frame local variable type at the given index.
   */
  private get(local: number): number {
    if (this.outputLocals == null || local >= this.outputLocals.length) {
      return Frame.LOCAL | local
    } else {
      let type: number = this.outputLocals[local]
      if (type === 0) {
        type = this.outputLocals[local] = Frame.LOCAL | local
      }
      return type
    }
  }

  /**
   * Sets the output frame local variable type at the given index.
   *
   * @param local
   * the index of the local that must be set.
   * @param type
   * the value of the local that must be set.
   */
  private set$int$int(local: number, type: number) {
    if (this.outputLocals == null) {
      this.outputLocals = new Array(10)
    }
    const n: number = this.outputLocals.length
    if (local >= n) {
      const t: number[] = new Array(Math.max(local + 1, 2 * n))
      for (let i = 0; i < n; i++) {
        t[i] = this.outputLocals[i]
      }
      // java.lang.System.arraycopy(this.outputLocals, 0, t, 0, n);
      this.outputLocals = t
    }
    this.outputLocals[local] = type
  }

  /**
   * Pushes a new type onto the output frame stack.
   *
   * @param type
   * the type that must be pushed.
   */
  private push$int(type: number) {
    if (this.outputStack == null) {
      this.outputStack = new Array(10)
    }
    const n: number = this.outputStack.length
    if (this.outputStackTop >= n) {
      const t: number[] = new Array(Math.max(this.outputStackTop + 1, 2 * n))
      for (let i = 0; i < n; i++) {
        t[i] = this.outputStack[i]
      }
      // java.lang.System.arraycopy(this.outputStack, 0, t, 0, n);
      this.outputStack = t
    }
    this.outputStack[this.outputStackTop++] = type
    assert(this.owner)
    const top: number = this.owner.inputStackTop + this.outputStackTop
    if (top > this.owner.outputStackMax) {
      this.owner.outputStackMax = top
    }
  }

  /**
   * Pushes a new type onto the output frame stack.
   *
   * @param cw
   * the ClassWriter to which this label belongs.
   * @param desc
   * the descriptor of the type to be pushed. Can also be a method
   * descriptor (in this case this method pushes its return type
   * onto the output frame stack).
   */
  public push(cw?: any, desc?: any): any {
    if ((isClassWriter(cw) || cw === null) && (typeof desc === 'string' || desc === null)) {
      const __args = Array.prototype.slice.call(arguments)
      return <any>(() => {
        const type: number = Frame.type(cw, desc)
        if (type !== 0) {
          this.push(type)
          if (type === Frame.LONG_$LI$() || type === Frame.DOUBLE_$LI$()) {
            this.push(Frame.TOP_$LI$())
          }
        }
      })()
    } else if ((typeof cw === 'number' || cw === null) && desc === undefined) {
      return <any>this.push$int(cw)
    } else {
      throw new Error('invalid overload')
    }
  }

  /**
   * Returns the int encoding of the given type.
   *
   * @param cw
   * the ClassWriter to which this label belongs.
   * @param desc
   * a type descriptor.
   * @return the int encoding of the given type.
   */
  private static type(cw: ClassWriter, desc: string): number {
    let t: string
    const index: number = desc.charAt(0) === '(' ? desc.indexOf(')') + 1 : 0
    switch (desc.charAt(index)) {
      case 'V':
        return 0
      case 'Z':
      case 'C':
      case 'B':
      case 'S':
      case 'I':
        return Frame.INTEGER_$LI$()
      case 'F':
        return Frame.FLOAT_$LI$()
      case 'J':
        return Frame.LONG_$LI$()
      case 'D':
        return Frame.DOUBLE_$LI$()
      case 'L':
        t = desc.substring(index + 1, desc.length - 1)
        return Frame.OBJECT_$LI$() | cw.addType(t)
      default:
        let data: number
        let dims: number = index + 1
        while (desc.charAt(dims) === '[') {
          ++dims
        }
        switch (desc.charAt(dims)) {
          case 'Z':
            data = Frame.BOOLEAN_$LI$()
            break
          case 'C':
            data = Frame.CHAR_$LI$()
            break
          case 'B':
            data = Frame.BYTE_$LI$()
            break
          case 'S':
            data = Frame.SHORT_$LI$()
            break
          case 'I':
            data = Frame.INTEGER_$LI$()
            break
          case 'F':
            data = Frame.FLOAT_$LI$()
            break
          case 'J':
            data = Frame.LONG_$LI$()
            break
          case 'D':
            data = Frame.DOUBLE_$LI$()
            break
          default:
            t = desc.substring(dims + 1, desc.length - 1)
            data = Frame.OBJECT_$LI$() | cw.addType(t)
        }
        return ((dims - index) << 28) | data
    }
  }

  /**
   * Pops a type from the output frame stack and returns its value.
   *
   * @return the type that has been popped from the output frame stack.
   */
  private pop$(): number {
    if (this.outputStackTop > 0) {
      return this.outputStack[--this.outputStackTop]
    } else {
      return Frame.STACK | -(--this.owner.inputStackTop)
    }
  }

  /**
   * Pops the given number of types from the output frame stack.
   *
   * @param elements
   * the number of types that must be popped.
   */
  private pop$int(elements: number) {
    if (this.outputStackTop >= elements) {
      this.outputStackTop -= elements
    } else {
      this.owner.inputStackTop -= elements - this.outputStackTop
      this.outputStackTop = 0
    }
  }

  /**
   * Pops a type from the output frame stack.
   *
   * @param desc
   * the descriptor of the type to be popped. Can also be a method
   * descriptor (in this case this method pops the types
   * corresponding to the method arguments).
   */
  public pop(desc?: string | number): any {
    if (typeof desc === 'string' || desc === null) {
      const __args = Array.prototype.slice.call(arguments)
      return <any>(() => {
        const c: string = desc.charAt(0)
        if (c === '(') {
          this.pop((Type.getArgumentsAndReturnSizes(desc) >> 2) - 1)
        } else if (c === 'J' || c === 'D') {
          this.pop(2)
        } else {
          this.pop(1)
        }
      })()
    } else if (typeof desc === 'number' || desc === null) {
      return this.pop$int(desc)
    } else if (desc === undefined) {
      return this.pop$()
    } else {
      throw new Error('invalid overload')
    }
  }

  /**
   * Adds a new type to the list of types on which a constructor is invoked in
   * the basic block.
   *
   * @param var
   * a type on a which a constructor is invoked.
   */
  private init$int(__var: number) {
    if (this.initializations == null) {
      this.initializations = new Array(2)
    }
    const n: number = this.initializations.length
    if (this.initializationCount >= n) {
      const t: number[] = new Array(Math.max(this.initializationCount + 1, 2 * n))
      for (let i = 0; i < n; i++) {
        t[i] = this.initializations[i]
      }
      // java.lang.System.arraycopy(this.initializations, 0, t, 0, n);
      this.initializations = t
    }
    this.initializations[this.initializationCount++] = __var
  }

  /**
   * Replaces the given type with the appropriate type if it is one of the
   * types on which a constructor is invoked in the basic block.
   *
   * @param cw
   * the ClassWriter to which this label belongs.
   * @param t
   * a type
   * @return t or, if t is one of the types on which a constructor is invoked
   * in the basic block, the type corresponding to this constructor.
   */
  public init(cw?: any, t?: any): any {
    if ((isClassWriter(cw != null) || cw === null) && (typeof t === 'number' || t === null)) {
      const __args = Array.prototype.slice.call(arguments)
      return (() => {
        let s: number
        if (t === Frame.UNINITIALIZED_THIS_$LI$()) {
          s = Frame.OBJECT_$LI$() | cw.addType(cw.thisName)
        } else if ((t & (Frame.DIM | Frame.BASE_KIND)) === Frame.UNINITIALIZED_$LI$()) {
          const type: string = cw.typeTable[t & Frame.BASE_VALUE].strVal1
          s = Frame.OBJECT_$LI$() | cw.addType(type)
        } else {
          return t
        }
        for (let j = 0; j < this.initializationCount; ++j) {
          let u: number = this.initializations![j]
          const dim: number = u & Frame.DIM
          const kind: number = u & Frame.KIND
          if (kind === Frame.LOCAL) {
            u = dim + this.inputLocals[u & Frame.VALUE]
          } else if (kind === Frame.STACK) {
            u = dim + this.inputStack[this.inputStack.length - (u & Frame.VALUE)]
          }
          if (t === u) {
            return s
          }
        }
        return t
      })()
    } else if ((typeof cw === 'number' || cw === null) && t === undefined) {
      return <any>this.init$int(cw)
    } else {
      throw new Error('invalid overload')
    }
  }

  /**
   * Initializes the input frame of the first basic block from the method
   * descriptor.
   *
   * @param cw
   * the ClassWriter to which this label belongs.
   * @param access
   * the access flags of the method to which this label belongs.
   * @param args
   * the formal parameter types of this method.
   * @param maxLocals
   * the maximum number of local variables of this method.
   */
  initInputFrame(cw: ClassWriter, access: number, args: Type[], maxLocals: number) {
    this.inputLocals = new Array(maxLocals)
    this.inputStack = new Array(0)
    let i = 0
    if ((access & Opcodes.ACC_STATIC) === 0) {
      if ((access & ACC_CONSTRUCTOR) === 0) {
        this.inputLocals[i++] = Frame.OBJECT_$LI$() | cw.addType(cw.thisName)
      } else {
        this.inputLocals[i++] = Frame.UNINITIALIZED_THIS_$LI$()
      }
    }
    for (let j = 0; j < args.length; ++j) {
      const t: number = Frame.type(cw, args[j].getDescriptor())
      this.inputLocals[i++] = t
      if (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$()) {
        this.inputLocals[i++] = Frame.TOP_$LI$()
      }
    }
    while (i < maxLocals) {
      this.inputLocals[i++] = Frame.TOP_$LI$()
    }
  }

  /**
   * Simulates the action of the given instruction on the output stack frame.
   *
   * @param opcode
   * the opcode of the instruction.
   * @param arg
   * the operand of the instruction, if any.
   * @param cw
   * the class writer to which this label belongs.
   * @param item
   * the operand of the instructions, if any.
   */
  execute(opcode: number, arg: number, cw: ClassWriter | null, item: Item | null) {
    let t1: number
    let t2: number
    let t3: number
    let t4: number
    switch (opcode) {
      case Opcodes.NOP:
      case Opcodes.INEG:
      case Opcodes.LNEG:
      case Opcodes.FNEG:
      case Opcodes.DNEG:
      case Opcodes.I2B:
      case Opcodes.I2C:
      case Opcodes.I2S:
      case Opcodes.GOTO:
      case Opcodes.RETURN:
        break
      case Opcodes.ACONST_NULL:
        this.push(Frame.NULL_$LI$())
        break
      case Opcodes.ICONST_M1:
      case Opcodes.ICONST_0:
      case Opcodes.ICONST_1:
      case Opcodes.ICONST_2:
      case Opcodes.ICONST_3:
      case Opcodes.ICONST_4:
      case Opcodes.ICONST_5:
      case Opcodes.BIPUSH:
      case Opcodes.SIPUSH:
      case Opcodes.ILOAD:
        this.push(Frame.INTEGER_$LI$())
        break
      case Opcodes.LCONST_0:
      case Opcodes.LCONST_1:
      case Opcodes.LLOAD:
        this.push(Frame.LONG_$LI$())
        this.push(Frame.TOP_$LI$())
        break
      case Opcodes.FCONST_0:
      case Opcodes.FCONST_1:
      case Opcodes.FCONST_2:
      case Opcodes.FLOAD:
        this.push(Frame.FLOAT_$LI$())
        break
      case Opcodes.DCONST_0:
      case Opcodes.DCONST_1:
      case Opcodes.DLOAD:
        this.push(Frame.DOUBLE_$LI$())
        this.push(Frame.TOP_$LI$())
        break
      case Opcodes.LDC:
        assert(cw)
        assert(item)
        switch (item.type) {
          case ClassWriterConstant.INT:
            this.push(Frame.INTEGER_$LI$())
            break
          case ClassWriterConstant.LONG:
            this.push(Frame.LONG_$LI$())
            this.push(Frame.TOP_$LI$())
            break
          case ClassWriterConstant.FLOAT:
            this.push(Frame.FLOAT_$LI$())
            break
          case ClassWriterConstant.DOUBLE:
            this.push(Frame.DOUBLE_$LI$())
            this.push(Frame.TOP_$LI$())
            break
          case ClassWriterConstant.CLASS:
            this.push(Frame.OBJECT_$LI$() | cw.addType('java/lang/Class'))
            break
          case ClassWriterConstant.STR:
            this.push(Frame.OBJECT_$LI$() | cw.addType('java/lang/String'))
            break
          case ClassWriterConstant.MTYPE:
            this.push(Frame.OBJECT_$LI$() | cw.addType('java/lang/invoke/MethodType'))
            break
          default:
            this.push(Frame.OBJECT_$LI$() | cw.addType('java/lang/invoke/MethodHandle'))
        }
        break
      case Opcodes.ALOAD:
        this.push(this.get(arg))
        break
      case Opcodes.IALOAD:
      case Opcodes.BALOAD:
      case Opcodes.CALOAD:
      case Opcodes.SALOAD:
        this.pop(2)
        this.push(Frame.INTEGER_$LI$())
        break
      case Opcodes.LALOAD:
      case Opcodes.D2L:
        this.pop(2)
        this.push(Frame.LONG_$LI$())
        this.push(Frame.TOP_$LI$())
        break
      case Opcodes.FALOAD:
        this.pop(2)
        this.push(Frame.FLOAT_$LI$())
        break
      case Opcodes.DALOAD:
      case Opcodes.L2D:
        this.pop(2)
        this.push(Frame.DOUBLE_$LI$())
        this.push(Frame.TOP_$LI$())
        break
      case Opcodes.AALOAD:
        this.pop(1)
        t1 = this.pop()
        this.push(Frame.ELEMENT_OF + t1)
        break
      case Opcodes.ISTORE:
      case Opcodes.FSTORE:
      case Opcodes.ASTORE:
        t1 = this.pop()
        this.set(arg, t1)
        if (arg > 0) {
          t2 = this.get(arg - 1)
          if (t2 === Frame.LONG_$LI$() || t2 === Frame.DOUBLE_$LI$()) {
            this.set(arg - 1, Frame.TOP_$LI$())
          } else if ((t2 & Frame.KIND) !== Frame.BASE) {
            this.set(arg - 1, t2 | Frame.TOP_IF_LONG_OR_DOUBLE)
          }
        }
        break
      case Opcodes.LSTORE:
      case Opcodes.DSTORE:
        this.pop(1)
        t1 = this.pop()
        this.set(arg, t1)
        this.set(arg + 1, Frame.TOP_$LI$())
        if (arg > 0) {
          t2 = this.get(arg - 1)
          if (t2 === Frame.LONG_$LI$() || t2 === Frame.DOUBLE_$LI$()) {
            this.set(arg - 1, Frame.TOP_$LI$())
          } else if ((t2 & Frame.KIND) !== Frame.BASE) {
            this.set(arg - 1, t2 | Frame.TOP_IF_LONG_OR_DOUBLE)
          }
        }
        break
      case Opcodes.IASTORE:
      case Opcodes.BASTORE:
      case Opcodes.CASTORE:
      case Opcodes.SASTORE:
      case Opcodes.FASTORE:
      case Opcodes.AASTORE:
        this.pop(3)
        break
      case Opcodes.LASTORE:
      case Opcodes.DASTORE:
        this.pop(4)
        break
      case Opcodes.POP:
      case Opcodes.IFEQ:
      case Opcodes.IFNE:
      case Opcodes.IFLT:
      case Opcodes.IFGE:
      case Opcodes.IFGT:
      case Opcodes.IFLE:
      case Opcodes.IRETURN:
      case Opcodes.FRETURN:
      case Opcodes.ARETURN:
      case Opcodes.TABLESWITCH:
      case Opcodes.LOOKUPSWITCH:
      case Opcodes.ATHROW:
      case Opcodes.MONITORENTER:
      case Opcodes.MONITOREXIT:
      case Opcodes.IFNULL:
      case Opcodes.IFNONNULL:
        this.pop(1)
        break
      case Opcodes.POP2:
      case Opcodes.IF_ICMPEQ:
      case Opcodes.IF_ICMPNE:
      case Opcodes.IF_ICMPLT:
      case Opcodes.IF_ICMPGE:
      case Opcodes.IF_ICMPGT:
      case Opcodes.IF_ICMPLE:
      case Opcodes.IF_ACMPEQ:
      case Opcodes.IF_ACMPNE:
      case Opcodes.LRETURN:
      case Opcodes.DRETURN:
        this.pop(2)
        break
      case Opcodes.DUP:
        t1 = this.pop()
        this.push(t1)
        this.push(t1)
        break
      case Opcodes.DUP_X1:
        t1 = this.pop()
        t2 = this.pop()
        this.push(t1)
        this.push(t2)
        this.push(t1)
        break
      case Opcodes.DUP_X2:
        t1 = this.pop()
        t2 = this.pop()
        t3 = this.pop()
        this.push(t1)
        this.push(t3)
        this.push(t2)
        this.push(t1)
        break
      case Opcodes.DUP2:
        t1 = this.pop()
        t2 = this.pop()
        this.push(t2)
        this.push(t1)
        this.push(t2)
        this.push(t1)
        break
      case Opcodes.DUP2_X1:
        t1 = this.pop()
        t2 = this.pop()
        t3 = this.pop()
        this.push(t2)
        this.push(t1)
        this.push(t3)
        this.push(t2)
        this.push(t1)
        break
      case Opcodes.DUP2_X2:
        t1 = this.pop()
        t2 = this.pop()
        t3 = this.pop()
        t4 = this.pop()
        this.push(t2)
        this.push(t1)
        this.push(t4)
        this.push(t3)
        this.push(t2)
        this.push(t1)
        break
      case Opcodes.SWAP:
        t1 = this.pop()
        t2 = this.pop()
        this.push(t1)
        this.push(t2)
        break
      case Opcodes.IADD:
      case Opcodes.ISUB:
      case Opcodes.IMUL:
      case Opcodes.IDIV:
      case Opcodes.IREM:
      case Opcodes.IAND:
      case Opcodes.IOR:
      case Opcodes.IXOR:
      case Opcodes.ISHL:
      case Opcodes.ISHR:
      case Opcodes.IUSHR:
      case Opcodes.L2I:
      case Opcodes.D2I:
      case Opcodes.FCMPL:
      case Opcodes.FCMPG:
        this.pop(2)
        this.push(Frame.INTEGER_$LI$())
        break
      case Opcodes.LADD:
      case Opcodes.LSUB:
      case Opcodes.LMUL:
      case Opcodes.LDIV:
      case Opcodes.LREM:
      case Opcodes.LAND:
      case Opcodes.LOR:
      case Opcodes.LXOR:
        this.pop(4)
        this.push(Frame.LONG_$LI$())
        this.push(Frame.TOP_$LI$())
        break
      case Opcodes.FADD:
      case Opcodes.FSUB:
      case Opcodes.FMUL:
      case Opcodes.FDIV:
      case Opcodes.FREM:
      case Opcodes.L2F:
      case Opcodes.D2F:
        this.pop(2)
        this.push(Frame.FLOAT_$LI$())
        break
      case Opcodes.DADD:
      case Opcodes.DSUB:
      case Opcodes.DMUL:
      case Opcodes.DDIV:
      case Opcodes.DREM:
        this.pop(4)
        this.push(Frame.DOUBLE_$LI$())
        this.push(Frame.TOP_$LI$())
        break
      case Opcodes.LSHL:
      case Opcodes.LSHR:
      case Opcodes.LUSHR:
        this.pop(3)
        this.push(Frame.LONG_$LI$())
        this.push(Frame.TOP_$LI$())
        break
      case Opcodes.IINC:
        this.set(arg, Frame.INTEGER_$LI$())
        break
      case Opcodes.I2L:
      case Opcodes.F2L:
        this.pop(1)
        this.push(Frame.LONG_$LI$())
        this.push(Frame.TOP_$LI$())
        break
      case Opcodes.I2F:
        this.pop(1)
        this.push(Frame.FLOAT_$LI$())
        break
      case Opcodes.I2D:
      case Opcodes.F2D:
        this.pop(1)
        this.push(Frame.DOUBLE_$LI$())
        this.push(Frame.TOP_$LI$())
        break
      case Opcodes.F2I:
      case Opcodes.ARRAYLENGTH:
      case Opcodes.INSTANCEOF:
        this.pop(1)
        this.push(Frame.INTEGER_$LI$())
        break
      case Opcodes.LCMP:
      case Opcodes.DCMPL:
      case Opcodes.DCMPG:
        this.pop(4)
        this.push(Frame.INTEGER_$LI$())
        break
      case Opcodes.JSR:
      case Opcodes.RET:
        throw new Error('JSR/RET are not supported with computeFrames option')
      case Opcodes.GETSTATIC:
        assert(item)
        this.push(cw, item.strVal3)
        break
      case Opcodes.PUTSTATIC:
        assert(item)
        this.pop(item.strVal3)
        break
      case Opcodes.GETFIELD:
        assert(item)
        this.pop(1)
        this.push(cw, item.strVal3)
        break
      case Opcodes.PUTFIELD:
        assert(item)
        this.pop(item.strVal3)
        this.pop()
        break
      case Opcodes.INVOKEVIRTUAL:
      case Opcodes.INVOKESPECIAL:
      case Opcodes.INVOKESTATIC:
      case Opcodes.INVOKEINTERFACE:
        assert(item)
        this.pop(item.strVal3)
        if (opcode !== Opcodes.INVOKESTATIC) {
          t1 = this.pop()
          if (opcode === Opcodes.INVOKESPECIAL && item.strVal2.charAt(0) === '<') {
            this.init(t1)
          }
        }
        this.push(cw, item.strVal3)
        break
      case Opcodes.INVOKEDYNAMIC:
        assert(item)
        this.pop(item.strVal2)
        this.push(cw, item.strVal2)
        break
      case Opcodes.NEW:
        assert(item)
        assert(cw)
        this.push(Frame.UNINITIALIZED_$LI$() | cw.addUninitializedType(item.strVal1, arg))
        break
      case Opcodes.NEWARRAY:
        this.pop()
        switch (arg) {
          case Opcodes.T_BOOLEAN:
            this.push(Frame.ARRAY_OF | Frame.BOOLEAN_$LI$())
            break
          case Opcodes.T_CHAR:
            this.push(Frame.ARRAY_OF | Frame.CHAR_$LI$())
            break
          case Opcodes.T_BYTE:
            this.push(Frame.ARRAY_OF | Frame.BYTE_$LI$())
            break
          case Opcodes.T_SHORT:
            this.push(Frame.ARRAY_OF | Frame.SHORT_$LI$())
            break
          case Opcodes.T_INT:
            this.push(Frame.ARRAY_OF | Frame.INTEGER_$LI$())
            break
          case Opcodes.T_FLOAT:
            this.push(Frame.ARRAY_OF | Frame.FLOAT_$LI$())
            break
          case Opcodes.T_DOUBLE:
            this.push(Frame.ARRAY_OF | Frame.DOUBLE_$LI$())
            break
          default:
            this.push(Frame.ARRAY_OF | Frame.LONG_$LI$())
            break
        }
        break
      case Opcodes.ANEWARRAY:
        assert(item)
        assert(cw)
        let s: string = item.strVal1
        this.pop()
        if (s.charAt(0) === '[') {
          this.push(cw, '[' + s)
        } else {
          this.push(Frame.ARRAY_OF | Frame.OBJECT_$LI$() | cw.addType(s))
        }
        break
      case Opcodes.CHECKCAST:
        assert(item)
        s = item.strVal1
        this.pop()
        if (s.charAt(0) === '[') {
          this.push(cw, s)
        } else {
          assert(cw)
          this.push(Frame.OBJECT_$LI$() | cw.addType(s))
        }
        break
      default:
        assert(item)
        this.pop(arg)
        this.push(cw, item.strVal1)
        break
    }
  }

  /**
   * Merges the input frame of the given basic block with the input and output
   * frames of this basic block. Returns <tt>true</tt> if the input frame of
   * the given label has been changed by this operation.
   *
   * @param cw
   * the ClassWriter to which this label belongs.
   * @param frame
   * the basic block whose input frame must be updated.
   * @param edge
   * the kind of the {@link Edge} between this label and 'label'.
   * See {@link Edge#info}.
   * @return <tt>true</tt> if the input frame of the given label has been
   * changed by this operation.
   */
  merge(cw: ClassWriter, frame: Frame, edge: number): boolean {
    let changed = false
    let i: number
    let s: number
    let dim: number
    let kind: number
    let t: number
    const nLocal: number = this.inputLocals.length
    const nStack: number = this.inputStack.length
    if (frame.inputLocals == null) {
      frame.inputLocals = new Array(nLocal)
      changed = true
    }
    for (i = 0; i < nLocal; ++i) {
      if (this.outputLocals != null && i < this.outputLocals.length) {
        s = this.outputLocals[i]
        if (s === 0) {
          t = this.inputLocals[i]
        } else {
          dim = s & Frame.DIM
          kind = s & Frame.KIND
          if (kind === Frame.BASE) {
            t = s
          } else {
            if (kind === Frame.LOCAL) {
              t = dim + this.inputLocals[s & Frame.VALUE]
            } else {
              t = dim + this.inputStack[nStack - (s & Frame.VALUE)]
            }
            if (
              (s & Frame.TOP_IF_LONG_OR_DOUBLE) !== 0 &&
              (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$())
            ) {
              t = Frame.TOP_$LI$()
            }
          }
        }
      } else {
        t = this.inputLocals[i]
      }
      if (this.initializations != null) {
        t = this.init(cw, t)
      }
      changed = changed || Frame.merge(cw, t, frame.inputLocals, i)
    }
    if (edge > 0) {
      for (i = 0; i < nLocal; ++i) {
        t = this.inputLocals[i]
        changed = changed || Frame.merge(cw, t, frame.inputLocals, i)
      }
      if (frame.inputStack == null) {
        frame.inputStack = new Array(1)
        changed = true
      }
      changed = changed || Frame.merge(cw, edge, frame.inputStack, 0)
      return changed
    }
    const nInputStack: number = this.inputStack.length + this.owner.inputStackTop
    if (frame.inputStack == null) {
      frame.inputStack = new Array(nInputStack + this.outputStackTop)
      changed = true
    }
    for (i = 0; i < nInputStack; ++i) {
      t = this.inputStack[i]
      if (this.initializations != null) {
        t = this.init(cw, t)
      }
      changed = changed || Frame.merge(cw, t, frame.inputStack, i)
    }
    for (i = 0; i < this.outputStackTop; ++i) {
      s = this.outputStack[i]
      dim = s & Frame.DIM
      kind = s & Frame.KIND
      if (kind === Frame.BASE) {
        t = s
      } else {
        if (kind === Frame.LOCAL) {
          t = dim + this.inputLocals[s & Frame.VALUE]
        } else {
          t = dim + this.inputStack[nStack - (s & Frame.VALUE)]
        }
        if (
          (s & Frame.TOP_IF_LONG_OR_DOUBLE) !== 0 &&
          (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$())
        ) {
          t = Frame.TOP_$LI$()
        }
      }
      if (this.initializations != null) {
        t = this.init(cw, t)
      }
      changed = changed || Frame.merge(cw, t, frame.inputStack, nInputStack + i)
    }
    return changed
  }

  /**
   * Merges the type at the given index in the given type array with the given
   * type. Returns <tt>true</tt> if the type array has been modified by this
   * operation.
   *
   * @param cw
   * the ClassWriter to which this label belongs.
   * @param t
   * the type with which the type array element must be merged.
   * @param types
   * an array of types.
   * @param index
   * the index of the type that must be merged in 'types'.
   * @return <tt>true</tt> if the type array has been modified by this
   * operation.
   */
  private static merge(cw: ClassWriter, t: number, types: number[], index: number): boolean {
    const u: number = types[index]
    if (u === t) {
      return false
    }
    if ((t & ~Frame.DIM) === Frame.NULL_$LI$()) {
      if (u === Frame.NULL_$LI$()) {
        return false
      }
      t = Frame.NULL_$LI$()
    }
    if (u === 0) {
      types[index] = t
      return true
    }
    let v: number
    if ((u & Frame.BASE_KIND) === Frame.OBJECT_$LI$() || (u & Frame.DIM) !== 0) {
      if (t === Frame.NULL_$LI$()) {
        return false
      } else if ((t & (Frame.DIM | Frame.BASE_KIND)) === (u & (Frame.DIM | Frame.BASE_KIND))) {
        if ((u & Frame.BASE_KIND) === Frame.OBJECT_$LI$()) {
          v =
            (t & Frame.DIM) |
            Frame.OBJECT_$LI$() |
            cw.getMergedType(t & Frame.BASE_VALUE, u & Frame.BASE_VALUE)
        } else {
          const vdim: number = Frame.ELEMENT_OF + (u & Frame.DIM)
          v = vdim | Frame.OBJECT_$LI$() | cw.addType('java/lang/Object')
        }
      } else if ((t & Frame.BASE_KIND) === Frame.OBJECT_$LI$() || (t & Frame.DIM) !== 0) {
        const tdim: number =
          ((t & Frame.DIM) === 0 || (t & Frame.BASE_KIND) === Frame.OBJECT_$LI$()
            ? 0
            : Frame.ELEMENT_OF) +
          (t & Frame.DIM)
        const udim: number =
          ((u & Frame.DIM) === 0 || (u & Frame.BASE_KIND) === Frame.OBJECT_$LI$()
            ? 0
            : Frame.ELEMENT_OF) +
          (u & Frame.DIM)
        v = Math.min(tdim, udim) | Frame.OBJECT_$LI$() | cw.addType('java/lang/Object')
      } else {
        v = Frame.TOP_$LI$()
      }
    } else if (u === Frame.NULL_$LI$()) {
      v =
        (t & Frame.BASE_KIND) === Frame.OBJECT_$LI$() || (t & Frame.DIM) !== 0
          ? t
          : Frame.TOP_$LI$()
    } else {
      v = Frame.TOP_$LI$()
    }
    if (u !== v) {
      types[index] = v
      return true
    }
    return false
  }

  constructor(owner: Label) {
    this.outputStackTop = 0
    this.initializationCount = 0
    this.owner = owner
  }
}

Frame.SIZE_$LI$()

Frame.UNINITIALIZED_THIS_$LI$()

Frame.NULL_$LI$()

Frame.LONG_$LI$()

Frame.DOUBLE_$LI$()

Frame.FLOAT_$LI$()

Frame.INTEGER_$LI$()

Frame.SHORT_$LI$()

Frame.CHAR_$LI$()

Frame.BYTE_$LI$()

Frame.BOOLEAN_$LI$()

Frame.TOP_$LI$()

Frame.UNINITIALIZED_$LI$()

Frame.OBJECT_$LI$()
