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
 * A {@link MethodVisitor} that generates methods in bytecode form. Each visit
 * method of this class appends the bytecode corresponding to the visited
 * instruction to a byte vector, in the order these methods are called.
 *
 * @author Eric Bruneton
 * @author Eugene Kuleshov
 */
import { AnnotationVisitor } from './AnnotationVisitor'
import { AnnotationWriter } from './AnnotationWriter'
import { Attribute } from './Attribute'
import { ByteVector } from './ByteVector'
import { ANNOTATIONS, FRAMES, SIGNATURES } from './ClassReaderConstant'
import type { ClassWriter } from './ClassWriter'
import * as ClassWriterConstant from './ClassWriterConstant'
import { CurrentFrame } from './CurrentFrame'
import { Edge } from './Edge'
import { Frame } from './Frame'
import { Handle } from './Handle'
import { Item } from './Item'
import { Label } from './Label'
import { MethodVisitor } from './MethodVisitor'
import { ACC_CONSTRUCTOR } from './MethodWriterConstant'
import { Opcodes } from './Opcodes'
import { Type } from './Type'
import { TypePath } from './TypePath'
import * as bits from './bits'
import { assert } from './utils'

export class MethodWriter extends MethodVisitor {
  /**
   * Frame has exactly the same locals as the previous stack map frame and
   * number of stack items is zero.
   */
  static SAME_FRAME = 0

  /**
   * Frame has exactly the same locals as the previous stack map frame and
   * number of stack items is 1
   */
  static SAME_LOCALS_1_STACK_ITEM_FRAME = 64

  /**
   * Reserved for future use
   */
  static RESERVED = 128

  /**
   * Frame has exactly the same locals as the previous stack map frame and
   * number of stack items is 1. Offset is bigger then 63;
   */
  static SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED = 247

  /**
   * Frame where current locals are the same as the locals in the previous
   * frame, except that the k last locals are absent. The value of k is given
   * by the formula 251-frame_type.
   */
  static CHOP_FRAME = 248

  /**
   * Frame has exactly the same locals as the previous stack map frame and
   * number of stack items is zero. Offset is bigger then 63;
   */
  static SAME_FRAME_EXTENDED = 251

  /**
   * Frame where current locals are the same as the locals in the previous
   * frame, except that k additional locals are defined. The value of k is
   * given by the formula frame_type-251.
   */
  static APPEND_FRAME = 252

  /**
   * Full frame
   */
  static FULL_FRAME = 255

  /**
   * Indicates that the stack map frames must be recomputed from scratch. In
   * this case the maximum stack size and number of local variables is also
   * recomputed from scratch.
   *
   * @see #compute
   */
  static FRAMES = 0

  /**
   * Indicates that the stack map frames of type F_INSERT must be computed.
   * The other frames are not (re)computed. They should all be of type F_NEW
   * and should be sufficient to compute the content of the F_INSERT frames,
   * together with the bytecode instructions between a F_NEW and a F_INSERT
   * frame - and without any knowledge of the type hierarchy (by definition of
   * F_INSERT).
   *
   * @see #compute
   */
  static INSERTED_FRAMES = 1

  /**
   * Indicates that the maximum stack size and number of local variables must
   * be automatically computed.
   *
   * @see #compute
   */
  static MAXS = 2

  /**
   * Indicates that nothing must be automatically computed.
   *
   * @see #compute
   */
  static NOTHING = 3

  /**
   * The class writer to which this method must be added.
   */
  cw: ClassWriter

  /**
   * Access flags of this method.
   */
  private access: number

  /**
   * The index of the constant pool item that contains the name of this
   * method.
   */
  private name: number

  /**
   * The index of the constant pool item that contains the descriptor of this
   * method.
   */
  private desc: number

  /**
   * The descriptor of this method.
   */
  private descriptor: string

  /**
   * The signature of this method.
   */
  signature: string | null = null

  /**
   * If not zero, indicates that the code of this method must be copied from
   * the ClassReader associated to this writer in <code>cw.cr</code>. More
   * precisely, this field gives the index of the first byte to copied from
   * <code>cw.cr.b</code>.
   */
  classReaderOffset: number

  /**
   * If not zero, indicates that the code of this method must be copied from
   * the ClassReader associated to this writer in <code>cw.cr</code>. More
   * precisely, this field gives the number of bytes to copied from
   * <code>cw.cr.b</code>.
   */
  classReaderLength: number

  /**
   * Number of exceptions that can be thrown by this method.
   */
  exceptionCount: number

  /**
   * The exceptions that can be thrown by this method. More precisely, this
   * array contains the indexes of the constant pool items that contain the
   * internal names of these exception classes.
   */
  exceptions: number[] | null = null

  /**
   * The annotation default attribute of this method. May be <tt>null</tt>.
   */
  private annd: ByteVector | null = null

  /**
   * The runtime visible annotations of this method. May be <tt>null</tt>.
   */
  private anns: AnnotationWriter | null = null

  /**
   * The runtime invisible annotations of this method. May be <tt>null</tt>.
   */
  private ianns: AnnotationWriter | null = null

  /**
   * The runtime visible type annotations of this method. May be <tt>null</tt>
   * .
   */
  private tanns: AnnotationWriter | null = null

  /**
   * The runtime invisible type annotations of this method. May be
   * <tt>null</tt>.
   */
  private itanns: AnnotationWriter | null = null

  /**
   * The runtime visible parameter annotations of this method. May be
   * <tt>null</tt>.
   */
  private panns: AnnotationWriter[] | null = null

  /**
   * The runtime invisible parameter annotations of this method. May be
   * <tt>null</tt>.
   */
  private ipanns: AnnotationWriter[] | null = null

  /**
   * The number of synthetic parameters of this method.
   */
  private synthetics: number

  /**
   * The non standard attributes of the method.
   */
  private attrs: Attribute | null = null

  /**
   * The bytecode of this method.
   */
  private code: ByteVector = new ByteVector()

  /**
   * Maximum stack size of this method.
   */
  private maxStack: number

  /**
   * Maximum number of local variables for this method.
   */
  private maxLocals: number

  /**
   * Number of local variables in the current stack map frame.
   */
  private currentLocals: number

  /**
   * Number of stack map frames in the StackMapTable attribute.
   */
  private frameCount: number

  /**
   * The StackMapTable attribute.
   */
  private stackMap: ByteVector | null = null

  /**
   * The offset of the last frame that was written in the StackMapTable
   * attribute.
   */
  private previousFrameOffset: number

  /**
   * The last frame that was written in the StackMapTable attribute.
   *
   * @see #frame
   */
  private previousFrame: number[] | null = null

  /**
   * The current stack map frame. The first element contains the offset of the
   * instruction to which the frame corresponds, the second element is the
   * number of locals and the third one is the number of stack elements. The
   * local variables start at index 3 and are followed by the operand stack
   * values. In summary frame[0] = offset, frame[1] = nLocal, frame[2] =
   * nStack, frame[3] = nLocal. All types are encoded as integers, with the
   * same format as the one used in {@link Label}, but limited to BASE types.
   */
  private frame: number[] | null = null

  /**
   * Number of elements in the exception handler list.
   */
  private handlerCount: number

  /**
   * The first element in the exception handler list.
   */
  private firstHandler: Handler | null = null

  /**
   * The last element in the exception handler list.
   */
  private lastHandler: Handler | null = null

  /**
   * Number of entries in the MethodParameters attribute.
   */
  private methodParametersCount: number

  /**
   * The MethodParameters attribute.
   */
  private methodParameters: ByteVector | null = null

  /**
   * Number of entries in the LocalVariableTable attribute.
   */
  private localVarCount: number

  /**
   * The LocalVariableTable attribute.
   */
  private localVar: ByteVector | null = null

  /**
   * Number of entries in the LocalVariableTypeTable attribute.
   */
  private localVarTypeCount: number

  /**
   * The LocalVariableTypeTable attribute.
   */
  private localVarType: ByteVector | null = null

  /**
   * Number of entries in the LineNumberTable attribute.
   */
  private lineNumberCount: number

  /**
   * The LineNumberTable attribute.
   */
  private lineNumber: ByteVector | null = null

  /**
   * The start offset of the last visited instruction.
   */
  private lastCodeOffset: number

  /**
   * The runtime visible type annotations of the code. May be <tt>null</tt>.
   */
  private ctanns: AnnotationWriter | null = null

  /**
   * The runtime invisible type annotations of the code. May be <tt>null</tt>.
   */
  private ictanns: AnnotationWriter | null = null

  /**
   * The non standard attributes of the method's code.
   */
  private cattrs: Attribute | null = null

  /**
   * The number of subroutines in this method.
   */
  private subroutines: number

  /**
   * Indicates what must be automatically computed.
   *
   * @see #FRAMES
   * @see #INSERTED_FRAMES
   * @see #MAXS
   * @see #NOTHING
   */
  private compute: number

  /**
   * A list of labels. This list is the list of basic blocks in the method,
   * i.e. a list of Label objects linked to each other by their
   * {@link Label#successor} field, in the order they are visited by
   * {@link MethodVisitor#visitLabel}, and starting with the first basic
   * block.
   */
  private labels: Label | null = null

  /**
   * The previous basic block.
   */
  private previousBlock: Label | null = null

  /**
   * The current basic block.
   */
  private currentBlock: Label | null = null

  /**
   * The (relative) stack size after the last visited instruction. This size
   * is relative to the beginning of the current basic block, i.e., the true
   * stack size after the last visited instruction is equal to the
   * {@link Label#inputStackTop beginStackSize} of the current basic block
   * plus <tt>stackSize</tt>.
   */
  private stackSize: number

  /**
   * The (relative) maximum stack size after the last visited instruction.
   * This size is relative to the beginning of the current basic block, i.e.,
   * the true maximum stack size after the last visited instruction is equal
   * to the {@link Label#inputStackTop beginStackSize} of the current basic
   * block plus <tt>stackSize</tt>.
   */
  private maxStackSize: number

  /**
   * Constructs a new {@link MethodWriter}.
   *
   * @param cw
   * the class writer in which the method must be added.
   * @param access
   * the method's access flags (see {@link Opcodes}).
   * @param name
   * the method's name.
   * @param desc
   * the method's descriptor (see {@link Type}).
   * @param signature
   * the method's signature. May be <tt>null</tt>.
   * @param exceptions
   * the internal names of the method's exceptions. May be
   * <tt>null</tt>.
   * @param compute
   * Indicates what must be automatically computed (see #compute).
   */
  constructor(
    cw: ClassWriter,
    access: number,
    name: string,
    desc: string,
    signature: string,
    exceptions: string[],
    compute: number,
  ) {
    super(Opcodes.ASM5)
    this.access = 0
    this.name = 0
    this.desc = 0
    this.classReaderOffset = 0
    this.classReaderLength = 0
    this.exceptionCount = 0
    this.synthetics = 0
    this.maxStack = 0
    this.maxLocals = 0
    this.currentLocals = 0
    this.frameCount = 0
    this.previousFrameOffset = 0
    this.handlerCount = 0
    this.methodParametersCount = 0
    this.localVarCount = 0
    this.localVarTypeCount = 0
    this.lineNumberCount = 0
    this.lastCodeOffset = 0
    this.subroutines = 0
    this.compute = 0
    this.stackSize = 0
    this.maxStackSize = 0
    if (cw.firstMethod == null) {
      cw.firstMethod = this
    } else {
      cw.lastMethod.mv = this
    }
    cw.lastMethod = this
    this.cw = cw
    this.access = access
    if (name === '<init>') {
      this.access |= ACC_CONSTRUCTOR
    }
    this.name = cw.newUTF8(name)
    this.desc = cw.newUTF8(desc)
    this.descriptor = desc
    if (SIGNATURES) {
      this.signature = signature
    }
    if (exceptions != null && exceptions.length > 0) {
      this.exceptionCount = exceptions.length
      this.exceptions = new Array(this.exceptionCount)
      for (let i = 0; i < this.exceptionCount; ++i) {
        this.exceptions[i] = cw.newClass(exceptions[i])
      }
    }
    this.compute = compute
    if (compute !== MethodWriter.NOTHING) {
      let size: number = Type.getArgumentsAndReturnSizes(this.descriptor) >> 2
      if ((access & Opcodes.ACC_STATIC) !== 0) {
        --size
      }
      this.maxLocals = size
      this.currentLocals = size
      this.labels = new Label()
      this.labels.status |= Label.PUSHED
      this.visitLabel(this.labels)
    }
  }

  public visitParameter(name: string, access: number) {
    if (this.methodParameters == null) {
      this.methodParameters = new ByteVector()
    }
    ++this.methodParametersCount
    this.methodParameters.putShort(name == null ? 0 : this.cw.newUTF8(name)).putShort(access)
  }

  public visitAnnotationDefault(): AnnotationVisitor | null {
    if (!ANNOTATIONS) {
      return null
    }
    this.annd = new ByteVector()
    return new AnnotationWriter(this.cw, false, this.annd, null, 0)
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

  public visitParameterAnnotation(
    parameter: number,
    desc: string,
    visible: boolean,
  ): AnnotationVisitor | null {
    if (!ANNOTATIONS) {
      return null
    }
    const bv: ByteVector = new ByteVector()
    if (desc === 'Ljava/lang/Synthetic;') {
      this.synthetics = Math.max(this.synthetics, parameter + 1)
      return new AnnotationWriter(this.cw, false, bv, null, 0)
    }
    bv.putShort(this.cw.newUTF8(desc)).putShort(0)
    const aw: AnnotationWriter = new AnnotationWriter(this.cw, true, bv, bv, 2)
    if (visible) {
      if (this.panns == null) {
        this.panns = new Array(Type.getArgumentTypes(this.descriptor).length)
      }
      aw.next = this.panns[parameter]
      this.panns[parameter] = aw
    } else {
      if (this.ipanns == null) {
        this.ipanns = new Array(Type.getArgumentTypes(this.descriptor).length)
      }
      aw.next = this.ipanns[parameter]
      this.ipanns[parameter] = aw
    }
    return aw
  }

  public visitAttribute(attr: Attribute) {
    if (attr.isCodeAttribute()) {
      attr.next = this.cattrs
      this.cattrs = attr
    } else {
      attr.next = this.attrs
      this.attrs = attr
    }
  }

  public visitCode() {}

  public visitFrame(type?: any, nLocal?: any, local?: any, nStack?: any, stack?: any): any {
    assert(this.frame)
    if (
      (typeof type === 'number' || type === null) &&
      (typeof nLocal === 'number' || nLocal === null) &&
      ((local != null && local instanceof Array) || local === null) &&
      (typeof nStack === 'number' || nStack === null) &&
      ((stack != null && stack instanceof Array) || stack === null)
    ) {
      const __args = Array.prototype.slice.call(arguments)
      return <any>(() => {
        if (!FRAMES || this.compute === MethodWriter.FRAMES) {
          return
        }
        if (this.compute === MethodWriter.INSERTED_FRAMES) {
          if (this.currentBlock && this.currentBlock.frame == null) {
            this.currentBlock.frame = new CurrentFrame(this.currentBlock)
            this.currentBlock.frame.initInputFrame(
              this.cw,
              this.access,
              Type.getArgumentTypes(this.descriptor),
              nLocal,
            )
            this.visitImplicitFirstFrame()
          } else {
            assert(this.currentBlock)
            if (type === Opcodes.F_NEW) {
              assert(this.currentBlock.frame)
              this.currentBlock.frame.set(this.cw, nLocal, local, nStack, stack)
            } else {
            }
            this.visitFrame(this.currentBlock.frame)
          }
        } else if (type === Opcodes.F_NEW) {
          if (this.previousFrame == null) {
            this.visitImplicitFirstFrame()
          }
          this.currentLocals = nLocal
          let frameIndex: number = this.startFrame(this.code.length, nLocal, nStack)
          for (let i = 0; i < nLocal; ++i) {
            if (typeof local[i] === 'string') {
              this.frame[frameIndex++] = Frame.OBJECT_$LI$() | this.cw.addType(<string>local[i])
            } else if (typeof local[i] === 'number') {
              this.frame[frameIndex++] = /* intValue */ <number>local[i] | 0
            } else {
              this.frame[frameIndex++] =
                Frame.UNINITIALIZED_$LI$() |
                this.cw.addUninitializedType('', (<Label>local[i]).position)
            }
          }
          for (let i = 0; i < nStack; ++i) {
            if (typeof stack[i] === 'string') {
              this.frame[frameIndex++] = Frame.OBJECT_$LI$() | this.cw.addType(<string>stack[i])
            } else if (typeof stack[i] === 'number') {
              this.frame[frameIndex++] = /* intValue */ <number>stack[i] | 0
            } else {
              this.frame[frameIndex++] =
                Frame.UNINITIALIZED_$LI$() |
                this.cw.addUninitializedType('', (<Label>stack[i]).position)
            }
          }
          this.endFrame()
        } else {
          let delta: number
          if (this.stackMap == null) {
            this.stackMap = new ByteVector()
            delta = this.code.length
          } else {
            delta = this.code.length - this.previousFrameOffset - 1
            if (delta < 0) {
              if (type === Opcodes.F_SAME) {
                return
              } else {
                throw new Error()
              }
            }
          }
          switch (type) {
            case Opcodes.F_FULL:
              this.currentLocals = nLocal
              this.stackMap.putByte(MethodWriter.FULL_FRAME).putShort(delta).putShort(nLocal)
              for (let i = 0; i < nLocal; ++i) {
                this.writeFrameType(local[i])
              }
              this.stackMap.putShort(nStack)
              for (let i = 0; i < nStack; ++i) {
                this.writeFrameType(stack[i])
              }
              break
            case Opcodes.F_APPEND:
              this.currentLocals += nLocal
              this.stackMap.putByte(MethodWriter.SAME_FRAME_EXTENDED + nLocal).putShort(delta)
              for (let i = 0; i < nLocal; ++i) {
                this.writeFrameType(local[i])
              }
              break
            case Opcodes.F_CHOP:
              this.currentLocals -= nLocal
              this.stackMap.putByte(MethodWriter.SAME_FRAME_EXTENDED - nLocal).putShort(delta)
              break
            case Opcodes.F_SAME:
              if (delta < 64) {
                this.stackMap.putByte(delta)
              } else {
                this.stackMap.putByte(MethodWriter.SAME_FRAME_EXTENDED).putShort(delta)
              }
              break
            case Opcodes.F_SAME1:
              if (delta < 64) {
                this.stackMap.putByte(MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME + delta)
              } else {
                this.stackMap
                  .putByte(MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED)
                  .putShort(delta)
              }
              this.writeFrameType(stack[0])
              break
          }
          this.previousFrameOffset = this.code.length
          ++this.frameCount
        }
        this.maxStack = Math.max(this.maxStack, nStack)
        this.maxLocals = Math.max(this.maxLocals, this.currentLocals)
      })()
    } else if (
      ((type != null && type instanceof Frame) || type === null) &&
      nLocal === undefined &&
      local === undefined &&
      nStack === undefined &&
      stack === undefined
    ) {
      return <any>this.visitFrame$Frame(type)
    } else {
      throw new Error('invalid overload')
    }
  }

  public visitInsn(opcode: number) {
    this.lastCodeOffset = this.code.length
    this.code.putByte(opcode)
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES || this.compute === MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.execute(opcode, 0, null, null)
      } else {
        const size: number = this.stackSize + Frame.SIZE_$LI$()[opcode]
        if (size > this.maxStackSize) {
          this.maxStackSize = size
        }
        this.stackSize = size
      }
      if ((opcode >= Opcodes.IRETURN && opcode <= Opcodes.RETURN) || opcode === Opcodes.ATHROW) {
        this.noSuccessor()
      }
    }
  }

  public visitIntInsn(opcode: number, operand: number) {
    this.lastCodeOffset = this.code.length
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES || this.compute === MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.execute(opcode, operand, null, null)
      } else if (opcode !== Opcodes.NEWARRAY) {
        const size: number = this.stackSize + 1
        if (size > this.maxStackSize) {
          this.maxStackSize = size
        }
        this.stackSize = size
      }
    }
    if (opcode === Opcodes.SIPUSH) {
      this.code.put12(opcode, operand)
    } else {
      this.code.put11(opcode, operand)
    }
  }

  public visitVarInsn(opcode: number, __var: number) {
    this.lastCodeOffset = this.code.length
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES || this.compute === MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.execute(opcode, __var, null, null)
      } else {
        if (opcode === Opcodes.RET) {
          this.currentBlock.status |= Label.RET
          this.currentBlock.inputStackTop = this.stackSize
          this.noSuccessor()
        } else {
          const size: number = this.stackSize + Frame.SIZE_$LI$()[opcode]
          if (size > this.maxStackSize) {
            this.maxStackSize = size
          }
          this.stackSize = size
        }
      }
    }
    if (this.compute !== MethodWriter.NOTHING) {
      let n: number
      if (
        opcode === Opcodes.LLOAD ||
        opcode === Opcodes.DLOAD ||
        opcode === Opcodes.LSTORE ||
        opcode === Opcodes.DSTORE
      ) {
        n = __var + 2
      } else {
        n = __var + 1
      }
      if (n > this.maxLocals) {
        this.maxLocals = n
      }
    }
    if (__var < 4 && opcode !== Opcodes.RET) {
      let opt: number
      if (opcode < Opcodes.ISTORE) {
        opt = 26 + ((opcode - Opcodes.ILOAD) << 2) + __var
      } else {
        opt = 59 + ((opcode - Opcodes.ISTORE) << 2) + __var
      }
      this.code.putByte(opt)
    } else if (__var >= 256) {
      this.code.putByte(196).put12(opcode, __var)
    } else {
      this.code.put11(opcode, __var)
    }
    if (opcode >= Opcodes.ISTORE && this.compute === MethodWriter.FRAMES && this.handlerCount > 0) {
      this.visitLabel(new Label())
    }
  }

  public visitTypeInsn(opcode: number, type: string) {
    this.lastCodeOffset = this.code.length
    const i: Item = this.cw.newClassItem(type)
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES || this.compute === MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.execute(opcode, this.code.length, this.cw, i)
      } else if (opcode === Opcodes.NEW) {
        const size: number = this.stackSize + 1
        if (size > this.maxStackSize) {
          this.maxStackSize = size
        }
        this.stackSize = size
      }
    }
    this.code.put12(opcode, i.index)
  }

  public visitFieldInsn(opcode: number, owner: string, name: string, desc: string) {
    this.lastCodeOffset = this.code.length
    const i: Item = this.cw.newFieldItem(owner, name, desc)
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES || this.compute === MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.execute(opcode, 0, this.cw, i)
      } else {
        let size: number
        const c: string = desc.charAt(0)
        switch (opcode) {
          case Opcodes.GETSTATIC:
            size = this.stackSize + (c === 'D' || c === 'J' ? 2 : 1)
            break
          case Opcodes.PUTSTATIC:
            size = this.stackSize + (c === 'D' || c === 'J' ? -2 : -1)
            break
          case Opcodes.GETFIELD:
            size = this.stackSize + (c === 'D' || c === 'J' ? 1 : 0)
            break
          default:
            size = this.stackSize + (c === 'D' || c === 'J' ? -3 : -2)
            break
        }
        if (size > this.maxStackSize) {
          this.maxStackSize = size
        }
        this.stackSize = size
      }
    }
    this.code.put12(opcode, i.index)
  }

  public visitMethodInsn(opcode?: any, owner?: any, name?: any, desc?: any, itf?: any): any {
    if (
      (typeof opcode === 'number' || opcode === null) &&
      (typeof owner === 'string' || owner === null) &&
      (typeof name === 'string' || name === null) &&
      (typeof desc === 'string' || desc === null) &&
      (typeof itf === 'boolean' || itf === null)
    ) {
      const __args = Array.prototype.slice.call(arguments)
      return <any>(() => {
        this.lastCodeOffset = this.code.length
        const i: Item = this.cw.newMethodItem(owner, name, desc, itf)
        let argSize: number = i.intVal
        if (this.currentBlock != null) {
          if (
            this.compute === MethodWriter.FRAMES ||
            this.compute === MethodWriter.INSERTED_FRAMES
          ) {
            assert(this.currentBlock.frame)
            this.currentBlock.frame.execute(opcode, 0, this.cw, i)
          } else {
            if (argSize === 0) {
              argSize = Type.getArgumentsAndReturnSizes(desc)
              i.intVal = argSize
            }
            let size: number
            if (opcode === Opcodes.INVOKESTATIC) {
              size = this.stackSize - (argSize >> 2) + (argSize & 3) + 1
            } else {
              size = this.stackSize - (argSize >> 2) + (argSize & 3)
            }
            if (size > this.maxStackSize) {
              this.maxStackSize = size
            }
            this.stackSize = size
          }
        }
        if (opcode === Opcodes.INVOKEINTERFACE) {
          if (argSize === 0) {
            argSize = Type.getArgumentsAndReturnSizes(desc)
            i.intVal = argSize
          }
          this.code.put12(Opcodes.INVOKEINTERFACE, i.index).put11(argSize >> 2, 0)
        } else {
          this.code.put12(opcode, i.index)
        }
      })()
    } else if (
      (typeof opcode === 'number' || opcode === null) &&
      (typeof owner === 'string' || owner === null) &&
      (typeof name === 'string' || name === null) &&
      (typeof desc === 'string' || desc === null) &&
      itf === undefined
    ) {
      return <any>(
        this.visitMethodInsn$int$java_lang_String$java_lang_String$java_lang_String(
          opcode,
          owner,
          name,
          desc,
        )
      )
    } else {
      throw new Error('invalid overload')
    }
  }

  public visitInvokeDynamicInsn(name: string, desc: string, bsm: Handle, ...bsmArgs: any[]) {
    this.lastCodeOffset = this.code.length
    const i: Item = this.cw.newInvokeDynamicItem(name, desc, bsm, ...bsmArgs)
    let argSize: number = i.intVal
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES || this.compute === MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.execute(Opcodes.INVOKEDYNAMIC, 0, this.cw, i)
      } else {
        if (argSize === 0) {
          argSize = Type.getArgumentsAndReturnSizes(desc)
          i.intVal = argSize
        }
        const size: number = this.stackSize - (argSize >> 2) + (argSize & 3) + 1
        if (size > this.maxStackSize) {
          this.maxStackSize = size
        }
        this.stackSize = size
      }
    }
    this.code.put12(Opcodes.INVOKEDYNAMIC, i.index)
    this.code.putShort(0)
  }

  public visitJumpInsn(opcode: number, label: Label) {
    const isWide: boolean = opcode >= 200
    opcode = isWide ? opcode - 33 : opcode
    this.lastCodeOffset = this.code.length
    let nextInsn: Label | null = null
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES) {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.execute(opcode, 0, null, null)
        label.getFirst().status |= Label.TARGET
        this.addSuccessor(Edge.NORMAL, label)
        if (opcode !== Opcodes.GOTO) {
          nextInsn = new Label()
        }
      } else if (this.compute === MethodWriter.INSERTED_FRAMES) {
        this.currentBlock.frame!.execute(opcode, 0, null, null)
      } else {
        if (opcode === Opcodes.JSR) {
          if ((label.status & Label.SUBROUTINE) === 0) {
            label.status |= Label.SUBROUTINE
            ++this.subroutines
          }
          this.currentBlock.status |= Label.JSR
          this.addSuccessor(this.stackSize + 1, label)
          nextInsn = new Label()
        } else {
          this.stackSize += Frame.SIZE_$LI$()[opcode]
          this.addSuccessor(this.stackSize, label)
        }
      }
    }
    if (
      (label.status & Label.RESOLVED) !== 0 &&
      label.position - this.code.length < bits.SHORT_MIN
    ) {
      if (opcode === Opcodes.GOTO) {
        this.code.putByte(200)
      } else if (opcode === Opcodes.JSR) {
        this.code.putByte(201)
      } else {
        if (nextInsn != null) {
          nextInsn.status |= Label.TARGET
        }
        this.code.putByte(opcode <= 166 ? ((opcode + 1) ^ 1) - 1 : opcode ^ 1)
        this.code.putShort(8)
        this.code.putByte(200)
      }
      label.put(this, this.code, this.code.length - 1, true)
    } else if (isWide) {
      this.code.putByte(opcode + 33)
      label.put(this, this.code, this.code.length - 1, true)
    } else {
      this.code.putByte(opcode)
      label.put(this, this.code, this.code.length - 1, false)
    }
    if (this.currentBlock != null) {
      if (nextInsn != null) {
        this.visitLabel(nextInsn)
      }
      if (opcode === Opcodes.GOTO) {
        this.noSuccessor()
      }
    }
  }

  public visitLabel(label: Label) {
    this.cw.hasAsmInsns =
      this.cw.hasAsmInsns || label.resolve(this, this.code.length, this.code.data)
    if ((label.status & Label.DEBUG) !== 0) {
      return
    }
    if (this.compute === MethodWriter.FRAMES) {
      if (this.currentBlock != null) {
        if (label.position === this.currentBlock.position) {
          this.currentBlock.status |= label.status & Label.TARGET
          label.frame = this.currentBlock.frame
          return
        }
        this.addSuccessor(Edge.NORMAL, label)
      }
      this.currentBlock = label
      if (label.frame == null) {
        label.frame = new Frame(label)
      }
      if (this.previousBlock != null) {
        if (label.position === this.previousBlock.position) {
          this.previousBlock.status |= label.status & Label.TARGET
          label.frame = this.previousBlock.frame
          this.currentBlock = this.previousBlock
          return
        }
        this.previousBlock.successor = label
      }
      this.previousBlock = label
    } else if (this.compute === MethodWriter.INSERTED_FRAMES) {
      if (this.currentBlock == null) {
        this.currentBlock = label
      } else {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.owner = label
      }
    } else if (this.compute === MethodWriter.MAXS) {
      if (this.currentBlock != null) {
        this.currentBlock.outputStackMax = this.maxStackSize
        this.addSuccessor(this.stackSize, label)
      }
      this.currentBlock = label
      this.stackSize = 0
      this.maxStackSize = 0
      if (this.previousBlock != null) {
        this.previousBlock.successor = label
      }
      this.previousBlock = label
    }
  }

  public visitLdcInsn(cst: any) {
    this.lastCodeOffset = this.code.length
    const i: Item = this.cw.newConstItem(cst)
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES || this.compute === MethodWriter.INSERTED_FRAMES) {
        this.currentBlock.frame!.execute(Opcodes.LDC, 0, this.cw, i)
      } else {
        let size: number
        if (i.type === ClassWriterConstant.LONG || i.type === ClassWriterConstant.DOUBLE) {
          size = this.stackSize + 2
        } else {
          size = this.stackSize + 1
        }
        if (size > this.maxStackSize) {
          this.maxStackSize = size
        }
        this.stackSize = size
      }
    }
    const index: number = i.index
    if (i.type === ClassWriterConstant.LONG || i.type === ClassWriterConstant.DOUBLE) {
      this.code.put12(20, index)
    } else if (index >= 256) {
      this.code.put12(19, index)
    } else {
      this.code.put11(Opcodes.LDC, index)
    }
  }

  public visitIincInsn(__var: number, increment: number) {
    this.lastCodeOffset = this.code.length
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES || this.compute === MethodWriter.INSERTED_FRAMES) {
        this.currentBlock.frame!.execute(Opcodes.IINC, __var, null, null)
      }
    }
    if (this.compute !== MethodWriter.NOTHING) {
      const n: number = __var + 1
      if (n > this.maxLocals) {
        this.maxLocals = n
      }
    }
    if (__var > 255 || increment > 127 || increment < -128) {
      this.code.putByte(196).put12(Opcodes.IINC, __var).putShort(increment)
    } else {
      this.code.putByte(Opcodes.IINC).put11(__var, increment)
    }
  }

  public visitTableSwitchInsn(min: number, max: number, dflt: Label, ...labels: Label[]) {
    this.lastCodeOffset = this.code.length
    const source: number = this.code.length
    this.code.putByte(Opcodes.TABLESWITCH)
    this.code.putByteArray(null, 0, (4 - (this.code.length % 4)) % 4)
    dflt.put(this, this.code, source, true)
    this.code.putInt(min).putInt(max)
    for (let i = 0; i < labels.length; ++i) {
      labels[i].put(this, this.code, source, true)
    }
    this.visitSwitchInsn(dflt, labels)
  }

  public visitLookupSwitchInsn(dflt: Label, keys: number[], labels: Label[]) {
    this.lastCodeOffset = this.code.length
    const source: number = this.code.length
    this.code.putByte(Opcodes.LOOKUPSWITCH)
    this.code.putByteArray(null, 0, (4 - (this.code.length % 4)) % 4)
    dflt.put(this, this.code, source, true)
    this.code.putInt(labels.length)
    for (let i = 0; i < labels.length; ++i) {
      this.code.putInt(keys[i])
      labels[i].put(this, this.code, source, true)
    }
    this.visitSwitchInsn(dflt, labels)
  }

  private visitSwitchInsn(dflt: Label, labels: Label[]) {
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES) {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.execute(Opcodes.LOOKUPSWITCH, 0, null, null)
        this.addSuccessor(Edge.NORMAL, dflt)
        dflt.getFirst().status |= Label.TARGET
        for (let i = 0; i < labels.length; ++i) {
          this.addSuccessor(Edge.NORMAL, labels[i])
          labels[i].getFirst().status |= Label.TARGET
        }
      } else {
        --this.stackSize
        this.addSuccessor(this.stackSize, dflt)
        for (let i = 0; i < labels.length; ++i) {
          this.addSuccessor(this.stackSize, labels[i])
        }
      }
      this.noSuccessor()
    }
  }

  public visitMultiANewArrayInsn(desc: string, dims: number) {
    this.lastCodeOffset = this.code.length
    const i: Item = this.cw.newClassItem(desc)
    if (this.currentBlock != null) {
      if (this.compute === MethodWriter.FRAMES || this.compute === MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame)
        this.currentBlock.frame.execute(Opcodes.MULTIANEWARRAY, dims, this.cw, i)
      } else {
        this.stackSize += 1 - dims
      }
    }
    this.code.put12(Opcodes.MULTIANEWARRAY, i.index).putByte(dims)
  }

  public visitInsnAnnotation(
    typeRef: number,
    typePath: TypePath,
    desc: string,
    visible: boolean,
  ): AnnotationVisitor | null {
    if (!ANNOTATIONS) {
      return null
    }
    const bv: ByteVector = new ByteVector()
    typeRef = (typeRef & -16776961) | (this.lastCodeOffset << 8)
    AnnotationWriter.putTarget(typeRef, typePath, bv)
    bv.putShort(this.cw.newUTF8(desc)).putShort(0)
    const aw: AnnotationWriter = new AnnotationWriter(this.cw, true, bv, bv, bv.length - 2)
    if (visible) {
      aw.next = this.ctanns
      this.ctanns = aw
    } else {
      aw.next = this.ictanns
      this.ictanns = aw
    }
    return aw
  }

  public visitTryCatchBlock(start: Label, end: Label, handler: Label, type: string) {
    ++this.handlerCount
    const h: Handler = new Handler()
    h.start = start
    h.end = end
    h.handler = handler
    h.desc = type
    h.type = type != null ? this.cw.newClass(type) : 0
    if (this.lastHandler == null) {
      this.firstHandler = h
    } else {
      this.lastHandler.next = h
    }
    this.lastHandler = h
  }

  public visitTryCatchAnnotation(
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
      aw.next = this.ctanns
      this.ctanns = aw
    } else {
      aw.next = this.ictanns
      this.ictanns = aw
    }
    return aw
  }

  public visitLocalVariable(
    name: string,
    desc: string,
    signature: string,
    start: Label,
    end: Label,
    index: number,
  ) {
    if (signature != null) {
      if (this.localVarType == null) {
        this.localVarType = new ByteVector()
      }
      ++this.localVarTypeCount
      this.localVarType
        .putShort(start.position)
        .putShort(end.position - start.position)
        .putShort(this.cw.newUTF8(name))
        .putShort(this.cw.newUTF8(signature))
        .putShort(index)
    }
    if (this.localVar == null) {
      this.localVar = new ByteVector()
    }
    ++this.localVarCount
    this.localVar
      .putShort(start.position)
      .putShort(end.position - start.position)
      .putShort(this.cw.newUTF8(name))
      .putShort(this.cw.newUTF8(desc))
      .putShort(index)
    if (this.compute !== MethodWriter.NOTHING) {
      const c: string = desc.charAt(0)
      const n: number = index + (c === 'J' || c === 'D' ? 2 : 1)
      if (n > this.maxLocals) {
        this.maxLocals = n
      }
    }
  }

  public visitLocalVariableAnnotation(
    typeRef: number,
    typePath: TypePath,
    start: Label[],
    end: Label[],
    index: number[],
    desc: string,
    visible: boolean,
  ): AnnotationVisitor | null {
    if (!ANNOTATIONS) {
      return null
    }
    const bv: ByteVector = new ByteVector()
    bv.putByte(typeRef >>> 24).putShort(start.length)
    for (let i = 0; i < start.length; ++i) {
      bv.putShort(start[i].position)
        .putShort(end[i].position - start[i].position)
        .putShort(index[i])
    }
    if (typePath == null) {
      bv.putByte(0)
    } else {
      const length: number = typePath.buf[typePath.offset] * 2 + 1
      bv.putByteArray(typePath.buf, typePath.offset, length)
    }
    bv.putShort(this.cw.newUTF8(desc)).putShort(0)
    const aw: AnnotationWriter = new AnnotationWriter(this.cw, true, bv, bv, bv.length - 2)
    if (visible) {
      aw.next = this.ctanns
      this.ctanns = aw
    } else {
      aw.next = this.ictanns
      this.ictanns = aw
    }
    return aw
  }

  public visitLineNumber(line: number, start: Label) {
    if (this.lineNumber == null) {
      this.lineNumber = new ByteVector()
    }
    ++this.lineNumberCount
    this.lineNumber.putShort(start.position)
    this.lineNumber.putShort(line)
  }

  public visitMaxs(maxStack: number, maxLocals: number) {
    if (FRAMES && this.compute === MethodWriter.FRAMES) {
      let handler: Handler | null = this.firstHandler
      while (handler != null) {
        assert(handler.start)
        assert(handler.handler)
        assert(handler.end)

        let l: Label = handler.start.getFirst()
        const h: Label = handler.handler.getFirst()
        const e: Label = handler.end.getFirst()
        const t: string = handler.desc == null ? 'java/lang/Throwable' : handler.desc
        const kind: number = Frame.OBJECT_$LI$() | this.cw.addType(t)
        h.status |= Label.TARGET
        while (l !== e) {
          const b: Edge = new Edge()
          b.info = kind
          b.successor = h
          b.next = l.successors
          l.successors = b
          l = l.successor
        }
        handler = handler.next
      }
      assert(this.labels)
      assert(this.labels.frame)
      let f: Frame | null = this.labels.frame
      f.initInputFrame(this.cw, this.access, Type.getArgumentTypes(this.descriptor), this.maxLocals)
      this.visitFrame(f)
      let max = 0
      let changed: Label | null = this.labels
      while (changed != null) {
        const l: Label = changed
        changed = changed.next
        l.next = null
        f = l.frame
        if ((l.status & Label.TARGET) !== 0) {
          l.status |= Label.STORE
        }
        assert(f)
        l.status |= Label.REACHABLE
        const blockMax: number = f.inputStack.length + l.outputStackMax
        if (blockMax > max) {
          max = blockMax
        }
        let e: Edge | null = l.successors
        while (e != null) {
          const n: Label = e.successor!.getFirst()
          const change: boolean = f.merge(this.cw, n.frame!, e.info)
          if (change && n.next == null) {
            n.next = changed
            changed = n
          }
          e = e.next
        }
      }
      let l: Label | null = this.labels
      while (l != null) {
        f = l.frame
        if ((l.status & Label.STORE) !== 0) {
          this.visitFrame(f)
        }
        if ((l.status & Label.REACHABLE) === 0) {
          const k: Label | null = l.successor
          const start: number = l.position
          const end: number = (k == null ? this.code.length : k.position) - 1
          if (end >= start) {
            max = Math.max(max, 1)
            for (let i: number = start; i < end; ++i) {
              this.code.data[i] = Opcodes.NOP
            }
            this.code.data[end] = Opcodes.ATHROW | 0
            const frameIndex: number = this.startFrame(start, 0, 1)
            assert(this.frame)
            this.frame[frameIndex] = Frame.OBJECT_$LI$() | this.cw.addType('java/lang/Throwable')
            this.endFrame()
            this.firstHandler = Handler.remove(this.firstHandler, l, k)
          }
        }
        l = l.successor
      }
      handler = this.firstHandler
      this.handlerCount = 0
      while (handler != null) {
        this.handlerCount += 1
        handler = handler.next
      }
      this.maxStack = max
    } else if (this.compute === MethodWriter.MAXS) {
      let handler: Handler | null = this.firstHandler
      while (handler != null) {
        let l: Label | null = handler.start
        const h: Label | null = handler.handler
        const e: Label | null = handler.end
        while (l !== e) {
          const b: Edge = new Edge()
          b.info = Edge.EXCEPTION
          b.successor = h
          if ((l!.status & Label.JSR) === 0) {
            b.next = l!.successors
            l!.successors = b
          } else {
            b.next = l!.successors.next!.next
            l!.successors.next!.next = b
          }
          l = l!.successor
        }
        handler = handler.next
      }
      if (this.subroutines > 0) {
        let id = 0
        assert(this.labels)
        this.labels.visitSubroutine(null, 1, this.subroutines)
        let l: Label | null = this.labels
        while (l != null) {
          if ((l.status & Label.JSR) !== 0) {
            const subroutine: Label | null = l.successors.next!.successor
            assert(subroutine)
            if ((subroutine.status & Label.VISITED) === 0) {
              id += 1
              subroutine.visitSubroutine(
                null,
                (Math.round(id / 32) << 32) | (1 << (id % 32)),
                this.subroutines,
              )
            }
          }
          l = l.successor
        }
        l = this.labels
        while (l != null) {
          if ((l.status & Label.JSR) !== 0) {
            let L: Label | null = this.labels
            while (L != null) {
              L.status &= ~Label.VISITED2
              L = L.successor
            }
            const subroutine = l.successors.next!.successor
            subroutine!.visitSubroutine(l, 0, this.subroutines)
          }
          l = l.successor
        }
      }
      let max = 0
      let stack: Label | null = this.labels
      while (stack != null) {
        let l: Label | null = stack
        stack = stack.next
        const start: number = l.inputStackTop
        const blockMax: number = start + l.outputStackMax
        if (blockMax > max) {
          max = blockMax
        }
        let b: Edge | null = l.successors
        if ((l.status & Label.JSR) !== 0) {
          b = b.next
        }
        while (b != null) {
          l = b.successor
          if (l && (l.status & Label.PUSHED) === 0) {
            l.inputStackTop = b.info === Edge.EXCEPTION ? 1 : start + b.info
            l.status |= Label.PUSHED
            l.next = stack
            stack = l
          }
          b = b.next
        }
      }
      this.maxStack = Math.max(maxStack, max)
    } else {
      this.maxStack = maxStack
      this.maxLocals = maxLocals
    }
  }

  public visitEnd() {}

  /**
   * Adds a successor to the {@link #currentBlock currentBlock} block.
   *
   * @param info
   * information about the control flow edge to be added.
   * @param successor
   * the successor block to be added to the current block.
   */
  private addSuccessor(info: number, successor: Label) {
    const b: Edge = new Edge()
    b.info = info
    b.successor = successor
    assert(this.currentBlock)
    b.next = this.currentBlock.successors
    this.currentBlock.successors = b
  }

  /**
   * Ends the current basic block. This method must be used in the case where
   * the current basic block does not have any successor.
   */
  private noSuccessor() {
    if (this.compute === MethodWriter.FRAMES) {
      const l: Label = new Label()
      l.frame = new Frame(l)
      l.resolve(this, this.code.length, this.code.data)
      this.previousBlock!.successor = l
      this.previousBlock = l
    } else {
      assert(this.currentBlock)
      this.currentBlock.outputStackMax = this.maxStackSize
    }
    if (this.compute !== MethodWriter.INSERTED_FRAMES) {
      this.currentBlock = null
    }
  }

  /**
   * Visits a frame that has been computed from scratch.
   *
   * @param f
   * the frame that must be visited.
   */
  private visitFrame$Frame(f: Frame) {
    let i: number
    let t: number
    let nTop = 0
    let nLocal = 0
    let nStack = 0
    const locals: number[] = f.inputLocals
    const stacks: number[] = f.inputStack
    for (i = 0; i < locals.length; ++i) {
      t = locals[i]
      if (t === Frame.TOP_$LI$()) {
        ++nTop
      } else {
        nLocal += nTop + 1
        nTop = 0
      }
      if (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$()) {
        ++i
      }
    }
    for (i = 0; i < stacks.length; ++i) {
      t = stacks[i]
      ++nStack
      if (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$()) {
        ++i
      }
    }
    let frameIndex: number = this.startFrame(f.owner.position, nLocal, nStack)
    assert(this.frame)
    for (i = 0; nLocal > 0; ++i, --nLocal) {
      t = locals[i]
      this.frame[frameIndex++] = t
      if (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$()) {
        ++i
      }
    }
    for (i = 0; i < stacks.length; ++i) {
      t = stacks[i]
      this.frame[frameIndex++] = t
      if (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$()) {
        ++i
      }
    }
    this.endFrame()
  }

  /**
   * Visit the implicit first frame of this method.
   */
  private visitImplicitFirstFrame() {
    assert(this.frame)
    let frameIndex: number = this.startFrame(0, this.descriptor.length + 1, 0)
    if ((this.access & Opcodes.ACC_STATIC) === 0) {
      if ((this.access & ACC_CONSTRUCTOR) === 0) {
        this.frame[frameIndex++] = Frame.OBJECT_$LI$() | this.cw.addType(this.cw.thisName)
      } else {
        this.frame[frameIndex++] = 6
      }
    }
    let i = 1
    loop: while (true) {
      const j: number = i
      switch (this.descriptor.charAt(i++)) {
        case 'Z':
        case 'C':
        case 'B':
        case 'S':
        case 'I':
          this.frame[frameIndex++] = 1
          break
        case 'F':
          this.frame[frameIndex++] = 2
          break
        case 'J':
          this.frame[frameIndex++] = 4
          break
        case 'D':
          this.frame[frameIndex++] = 3
          break
        case '[':
          while (this.descriptor.charAt(i) === '[') {
            ++i
          }
          if (this.descriptor.charAt(i) === 'L') {
            ++i
            while (this.descriptor.charAt(i) !== ';') {
              ++i
            }
          }
          this.frame[frameIndex++] =
            Frame.OBJECT_$LI$() | this.cw.addType(this.descriptor.substring(j, ++i))
          break
        case 'L':
          while (this.descriptor.charAt(i) !== ';') {
            ++i
          }
          this.frame[frameIndex++] =
            Frame.OBJECT_$LI$() | this.cw.addType(this.descriptor.substring(j + 1, i++))
          break
        default:
          break loop
      }
    }
    this.frame[1] = frameIndex - 3
    this.endFrame()
  }

  /**
   * Starts the visit of a stack map frame.
   *
   * @param offset
   * the offset of the instruction to which the frame corresponds.
   * @param nLocal
   * the number of local variables in the frame.
   * @param nStack
   * the number of stack elements in the frame.
   * @return the index of the next element to be written in this frame.
   */
  private startFrame(offset: number, nLocal: number, nStack: number): number {
    const n: number = 3 + nLocal + nStack
    if (this.frame == null || this.frame.length < n) {
      this.frame = new Array(n)
    }
    this.frame[0] = offset
    this.frame[1] = nLocal
    this.frame[2] = nStack
    return 3
  }

  /**
   * Checks if the visit of the current frame {@link #frame} is finished, and
   * if yes, write it in the StackMapTable attribute.
   */
  private endFrame() {
    if (this.previousFrame != null) {
      if (this.stackMap == null) {
        this.stackMap = new ByteVector()
      }
      this.writeFrame()
      ++this.frameCount
    }
    this.previousFrame = this.frame
    this.frame = null
  }

  /**
   * Compress and writes the current frame {@link #frame} in the StackMapTable
   * attribute.
   */
  private writeFrame() {
    assert(this.frame)
    assert(this.previousFrame)
    assert(this.stackMap)

    const clocalsSize: number = this.frame[1]
    const cstackSize: number = this.frame[2]
    if ((this.cw.version & 65535) < Opcodes.V1_6) {
      this.stackMap.putShort(this.frame[0]).putShort(clocalsSize)
      this.writeFrameTypes(3, 3 + clocalsSize)
      this.stackMap.putShort(cstackSize)
      this.writeFrameTypes(3 + clocalsSize, 3 + clocalsSize + cstackSize)
      return
    }
    let localsSize: number = this.previousFrame[1]
    let type: number = MethodWriter.FULL_FRAME
    let k = 0
    let delta: number
    if (this.frameCount === 0) {
      delta = this.frame[0]
    } else {
      delta = this.frame[0] - this.previousFrame[0] - 1
    }
    if (cstackSize === 0) {
      k = clocalsSize - localsSize
      switch (k) {
        case -3:
        case -2:
        case -1:
          type = MethodWriter.CHOP_FRAME
          localsSize = clocalsSize
          break
        case 0:
          type = delta < 64 ? MethodWriter.SAME_FRAME : MethodWriter.SAME_FRAME_EXTENDED
          break
        case 1:
        case 2:
        case 3:
          type = MethodWriter.APPEND_FRAME
          break
      }
    } else if (clocalsSize === localsSize && cstackSize === 1) {
      type =
        delta < 63
          ? MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME
          : MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED
    }
    if (type !== MethodWriter.FULL_FRAME) {
      let l = 3
      for (let j = 0; j < localsSize; j++) {
        if (this.frame[l] !== this.previousFrame[l]) {
          type = MethodWriter.FULL_FRAME
          break
        }
        l++
      }
    }
    switch (type) {
      case MethodWriter.SAME_FRAME:
        this.stackMap.putByte(delta)
        break
      case MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME:
        this.stackMap.putByte(MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME + delta)
        this.writeFrameTypes(3 + clocalsSize, 4 + clocalsSize)
        break
      case MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED:
        this.stackMap.putByte(MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED).putShort(delta)
        this.writeFrameTypes(3 + clocalsSize, 4 + clocalsSize)
        break
      case MethodWriter.SAME_FRAME_EXTENDED:
        this.stackMap.putByte(MethodWriter.SAME_FRAME_EXTENDED).putShort(delta)
        break
      case MethodWriter.CHOP_FRAME:
        this.stackMap.putByte(MethodWriter.SAME_FRAME_EXTENDED + k).putShort(delta)
        break
      case MethodWriter.APPEND_FRAME:
        this.stackMap.putByte(MethodWriter.SAME_FRAME_EXTENDED + k).putShort(delta)
        this.writeFrameTypes(3 + localsSize, 3 + clocalsSize)
        break
      default:
        this.stackMap.putByte(MethodWriter.FULL_FRAME).putShort(delta).putShort(clocalsSize)
        this.writeFrameTypes(3, 3 + clocalsSize)
        this.stackMap.putShort(cstackSize)
        this.writeFrameTypes(3 + clocalsSize, 3 + clocalsSize + cstackSize)
    }
  }

  /**
   * Writes some types of the current frame {@link #frame} into the
   * StackMapTableAttribute. This method converts types from the format used
   * in {@link Label} to the format used in StackMapTable attributes. In
   * particular, it converts type table indexes to constant pool indexes.
   *
   * @param start
   * index of the first type in {@link #frame} to write.
   * @param end
   * index of last type in {@link #frame} to write (exclusive).
   */
  private writeFrameTypes(start: number, end: number) {
    assert(this.frame)
    assert(this.stackMap)

    for (let i: number = start; i < end; ++i) {
      const t: number = this.frame[i]
      let d: number = t & Frame.DIM
      if (d === 0) {
        const v: number = t & Frame.BASE_VALUE
        switch (t & Frame.BASE_KIND) {
          case Frame.OBJECT_$LI$():
            this.stackMap.putByte(7).putShort(this.cw.newClass(this.cw.typeTable[v].strVal1))
            break
          case Frame.UNINITIALIZED_$LI$():
            this.stackMap.putByte(8).putShort(this.cw.typeTable[v].intVal)
            break
          default:
            this.stackMap.putByte(v)
        }
      } else {
        let sb = ''
        d >>= 28
        while (d-- > 0) {
          sb += '['
        }
        if ((t & Frame.BASE_KIND) === Frame.OBJECT_$LI$()) {
          sb += 'L'
          sb += this.cw.typeTable[t & Frame.BASE_VALUE].strVal1
          sb += ';'
        } else {
          switch (t & 15) {
            case 1:
              sb += 'I'
              break
            case 2:
              sb += 'F'
              break
            case 3:
              sb += 'D'
              break
            case 9:
              sb += 'Z'
              break
            case 10:
              sb += 'B'
              break
            case 11:
              sb += 'C'
              break
            case 12:
              sb += 'S'
              break
            default:
              sb += 'J'
          }
        }
        this.stackMap.putByte(7).putShort(this.cw.newClass(sb.toString()))
      }
    }
  }

  private writeFrameType(type: any) {
    assert(this.stackMap)
    if (typeof type === 'string') {
      this.stackMap.putByte(7).putShort(this.cw.newClass(type))
    } else if (typeof type === 'number') {
      this.stackMap.putByte(/* intValue */ type | 0)
    } else {
      this.stackMap.putByte(8).putShort((<Label>type).position)
    }
  }

  /**
   * Returns the size of the bytecode of this method.
   *
   * @return the size of the bytecode of this method.
   */
  getSize(): number {
    if (this.classReaderOffset !== 0) {
      return 6 + this.classReaderLength
    }
    let size = 8
    if (this.code.length > 0) {
      if (this.code.length > 65535) {
        throw new Error('Method code too large!')
      }
      this.cw.newUTF8('Code')
      size += 18 + this.code.length + 8 * this.handlerCount
      if (this.localVar != null) {
        this.cw.newUTF8('LocalVariableTable')
        size += 8 + this.localVar.length
      }
      if (this.localVarType != null) {
        this.cw.newUTF8('LocalVariableTypeTable')
        size += 8 + this.localVarType.length
      }
      if (this.lineNumber != null) {
        this.cw.newUTF8('LineNumberTable')
        size += 8 + this.lineNumber.length
      }
      if (this.stackMap != null) {
        const zip: boolean = (this.cw.version & 65535) >= Opcodes.V1_6
        this.cw.newUTF8(zip ? 'StackMapTable' : 'StackMap')
        size += 8 + this.stackMap.length
      }
      if (ANNOTATIONS && this.ctanns != null) {
        this.cw.newUTF8('RuntimeVisibleTypeAnnotations')
        size += 8 + this.ctanns.getSize()
      }
      if (ANNOTATIONS && this.ictanns != null) {
        this.cw.newUTF8('RuntimeInvisibleTypeAnnotations')
        size += 8 + this.ictanns.getSize()
      }
      if (this.cattrs != null) {
        size += this.cattrs.getSize(
          this.cw,
          this.code.data,
          this.code.length,
          this.maxStack,
          this.maxLocals,
        )
      }
    }
    if (this.exceptionCount > 0) {
      this.cw.newUTF8('Exceptions')
      size += 8 + 2 * this.exceptionCount
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
    if (SIGNATURES && this.signature != null) {
      this.cw.newUTF8('Signature')
      this.cw.newUTF8(this.signature)
      size += 8
    }
    if (this.methodParameters != null) {
      this.cw.newUTF8('MethodParameters')
      size += 7 + this.methodParameters.length
    }
    if (ANNOTATIONS && this.annd != null) {
      this.cw.newUTF8('AnnotationDefault')
      size += 6 + this.annd.length
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
    if (ANNOTATIONS && this.panns != null) {
      this.cw.newUTF8('RuntimeVisibleParameterAnnotations')
      size += 7 + 2 * (this.panns.length - this.synthetics)
      for (let i: number = this.panns.length - 1; i >= this.synthetics; --i) {
        size += this.panns[i] == null ? 0 : this.panns[i].getSize()
      }
    }
    if (ANNOTATIONS && this.ipanns != null) {
      this.cw.newUTF8('RuntimeInvisibleParameterAnnotations')
      size += 7 + 2 * (this.ipanns.length - this.synthetics)
      for (let i: number = this.ipanns.length - 1; i >= this.synthetics; --i) {
        size += this.ipanns[i] == null ? 0 : this.ipanns[i].getSize()
      }
    }
    if (this.attrs != null) {
      size += this.attrs.getSize(this.cw, null, 0, -1, -1)
    }
    return size
  }

  /**
   * Puts the bytecode of this method in the given byte vector.
   *
   * @param out
   * the byte vector into which the bytecode of this method must be
   * copied.
   */
  put(out: ByteVector) {
    const FACTOR: number = ClassWriterConstant.TO_ACC_SYNTHETIC_$LI$()
    const mask: number =
      ACC_CONSTRUCTOR |
      Opcodes.ACC_DEPRECATED |
      ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE |
      (((this.access & ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE) / FACTOR) | 0)
    out
      .putShort(this.access & ~mask)
      .putShort(this.name)
      .putShort(this.desc)
    if (this.classReaderOffset !== 0) {
      out.putByteArray(this.cw.cr.buf, this.classReaderOffset, this.classReaderLength)
      return
    }
    let attributeCount = 0
    if (this.code.length > 0) {
      ++attributeCount
    }
    if (this.exceptionCount > 0) {
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
    if (SIGNATURES && this.signature != null) {
      ++attributeCount
    }
    if (this.methodParameters != null) {
      ++attributeCount
    }
    if (ANNOTATIONS && this.annd != null) {
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
    if (ANNOTATIONS && this.panns != null) {
      ++attributeCount
    }
    if (ANNOTATIONS && this.ipanns != null) {
      ++attributeCount
    }
    if (this.attrs != null) {
      attributeCount += this.attrs.getCount()
    }
    out.putShort(attributeCount)
    if (this.code.length > 0) {
      let size: number = 12 + this.code.length + 8 * this.handlerCount
      if (this.localVar != null) {
        size += 8 + this.localVar.length
      }
      if (this.localVarType != null) {
        size += 8 + this.localVarType.length
      }
      if (this.lineNumber != null) {
        size += 8 + this.lineNumber.length
      }
      if (this.stackMap != null) {
        size += 8 + this.stackMap.length
      }
      if (ANNOTATIONS && this.ctanns != null) {
        size += 8 + this.ctanns.getSize()
      }
      if (ANNOTATIONS && this.ictanns != null) {
        size += 8 + this.ictanns.getSize()
      }
      if (this.cattrs != null) {
        size += this.cattrs.getSize(
          this.cw,
          this.code.data,
          this.code.length,
          this.maxStack,
          this.maxLocals,
        )
      }
      out.putShort(this.cw.newUTF8('Code')).putInt(size)
      out.putShort(this.maxStack).putShort(this.maxLocals)
      out.putInt(this.code.length).putByteArray(this.code.data, 0, this.code.length)
      out.putShort(this.handlerCount)
      if (this.handlerCount > 0) {
        let h: Handler | null = this.firstHandler
        while (h != null) {
          out
            .putShort(h.start!.position)
            .putShort(h.end!.position)
            .putShort(h.handler!.position)
            .putShort(h.type)
          h = h.next
        }
      }
      attributeCount = 0
      if (this.localVar != null) {
        ++attributeCount
      }
      if (this.localVarType != null) {
        ++attributeCount
      }
      if (this.lineNumber != null) {
        ++attributeCount
      }
      if (this.stackMap != null) {
        ++attributeCount
      }
      if (ANNOTATIONS && this.ctanns != null) {
        ++attributeCount
      }
      if (ANNOTATIONS && this.ictanns != null) {
        ++attributeCount
      }
      if (this.cattrs != null) {
        attributeCount += this.cattrs.getCount()
      }
      out.putShort(attributeCount)
      if (this.localVar != null) {
        out.putShort(this.cw.newUTF8('LocalVariableTable'))
        out.putInt(this.localVar.length + 2).putShort(this.localVarCount)
        out.putByteArray(this.localVar.data, 0, this.localVar.length)
      }
      if (this.localVarType != null) {
        out.putShort(this.cw.newUTF8('LocalVariableTypeTable'))
        out.putInt(this.localVarType.length + 2).putShort(this.localVarTypeCount)
        out.putByteArray(this.localVarType.data, 0, this.localVarType.length)
      }
      if (this.lineNumber != null) {
        out.putShort(this.cw.newUTF8('LineNumberTable'))
        out.putInt(this.lineNumber.length + 2).putShort(this.lineNumberCount)
        out.putByteArray(this.lineNumber.data, 0, this.lineNumber.length)
      }
      if (this.stackMap != null) {
        const zip: boolean = (this.cw.version & 65535) >= Opcodes.V1_6
        out.putShort(this.cw.newUTF8(zip ? 'StackMapTable' : 'StackMap'))
        out.putInt(this.stackMap.length + 2).putShort(this.frameCount)
        out.putByteArray(this.stackMap.data, 0, this.stackMap.length)
      }
      if (ANNOTATIONS && this.ctanns != null) {
        out.putShort(this.cw.newUTF8('RuntimeVisibleTypeAnnotations'))
        this.ctanns.put(out)
      }
      if (ANNOTATIONS && this.ictanns != null) {
        out.putShort(this.cw.newUTF8('RuntimeInvisibleTypeAnnotations'))
        this.ictanns.put(out)
      }
      if (this.cattrs != null) {
        this.cattrs.put(
          this.cw,
          this.code.data,
          this.code.length,
          this.maxLocals,
          this.maxStack,
          out,
        )
      }
    }
    if (this.exceptionCount > 0) {
      assert(this.exceptions)
      out.putShort(this.cw.newUTF8('Exceptions')).putInt(2 * this.exceptionCount + 2)
      out.putShort(this.exceptionCount)
      for (let i = 0; i < this.exceptionCount; ++i) {
        out.putShort(this.exceptions[i])
      }
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
    if (SIGNATURES && this.signature != null) {
      out.putShort(this.cw.newUTF8('Signature')).putInt(2).putShort(this.cw.newUTF8(this.signature))
    }
    if (this.methodParameters != null) {
      out.putShort(this.cw.newUTF8('MethodParameters'))
      out.putInt(this.methodParameters.length + 1).putByte(this.methodParametersCount)
      out.putByteArray(this.methodParameters.data, 0, this.methodParameters.length)
    }
    if (ANNOTATIONS && this.annd != null) {
      out.putShort(this.cw.newUTF8('AnnotationDefault'))
      out.putInt(this.annd.length)
      out.putByteArray(this.annd.data, 0, this.annd.length)
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
    if (ANNOTATIONS && this.panns != null) {
      out.putShort(this.cw.newUTF8('RuntimeVisibleParameterAnnotations'))
      AnnotationWriter.put(this.panns, this.synthetics, out)
    }
    if (ANNOTATIONS && this.ipanns != null) {
      out.putShort(this.cw.newUTF8('RuntimeInvisibleParameterAnnotations'))
      AnnotationWriter.put(this.ipanns, this.synthetics, out)
    }
    if (this.attrs != null) {
      this.attrs.put(this.cw, null, 0, -1, -1, out)
    }
  }
}

class Handler {
  /**
   * Beginning of the exception handler's scope (inclusive).
   */
  start: Label | null = null

  /**
   * End of the exception handler's scope (exclusive).
   */
  end: Label | null = null

  /**
   * Beginning of the exception handler's code.
   */
  handler: Label | null = null

  /**
   * Internal name of the type of exceptions handled by this handler, or
   * <tt>null</tt> to catch any exceptions.
   */
  desc = ''

  /**
   * Constant pool index of the internal name of the type of exceptions
   * handled by this handler, or 0 to catch any exceptions.
   */
  type: number

  /**
   * Next exception handler block info.
   */
  next: Handler | null = null

  /**
   * Removes the range between start and end from the given exception
   * handlers.
   *
   * @param h
   * an exception handler list.
   * @param start
   * the start of the range to be removed.
   * @param end
   * the end of the range to be removed. Maybe null.
   * @return the exception handler list with the start-end range removed.
   */
  static remove(h: Handler | null, start: Label, end: Label): Handler | null {
    if (h == null) {
      return null
    } else {
      h.next = Handler.remove(h.next, start, end)
    }
    assert(h.start)
    assert(h.end)
    const hstart: number = h.start.position
    const hend: number = h.end.position
    const s: number = start.position
    // let e : number = end == null?javaemul.internal.IntegerHelper.MAX_VALUE:end.position;
    const e: number = end == null ? Number.MAX_VALUE : end.position
    if (s < hend && e > hstart) {
      if (s <= hstart) {
        if (e >= hend) {
          h = h.next
        } else {
          h.start = end
        }
      } else if (e >= hend) {
        h.end = start
      } else {
        const g: Handler = new Handler()
        g.start = end
        g.end = h.end
        g.handler = h.handler
        g.desc = h.desc
        g.type = h.type
        g.next = h.next
        h.end = start
        h.next = g
      }
    }
    return h
  }

  constructor() {
    this.type = 0
  }
}
