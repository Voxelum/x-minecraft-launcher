// @ts-nocheck
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
 * A {@link ClassVisitor} that generates classes in bytecode form. More
 * precisely this visitor generates a byte array conforming to the Java class
 * file format. It can be used alone, to generate a Java class "from scratch",
 * or with one or more {@link ClassReader ClassReader} and adapter class visitor
 * to generate a modified class from one or more existing Java classes.
 *
 * @author Eric Bruneton
 */

import type { ClassReader } from './ClassReader'
import type { ClassVisitor } from './ClassVisitor'
import type { MethodVisitor } from './MethodVisitor'
import { Opcodes } from './Opcodes'

/**
 * Flag to automatically compute the maximum stack size and the maximum
 * number of local variables of methods. If this flag is set, then the
 * arguments of the {@link MethodVisitor#visitMaxs visitMaxs} method of the
 * {@link MethodVisitor} returned by the {@link #visitMethod visitMethod}
 * method will be ignored, and computed automatically from the signature and
 * the bytecode of each method.
 *
 * @see #ClassWriter(int)
 */
export const COMPUTE_MAXS = 1

/**
 * Flag to automatically compute the stack map frames of methods from
 * scratch. If this flag is set, then the calls to the
 * {@link MethodVisitor#visitFrame} method are ignored, and the stack map
 * frames are recomputed from the methods bytecode. The arguments of the
 * {@link MethodVisitor#visitMaxs visitMaxs} method are also ignored and
 * recomputed from the bytecode. In other words, COMPUTE_FRAMES implies
 * COMPUTE_MAXS.
 *
 * @see #ClassWriter(int)
 */
export const COMPUTE_FRAMES = 2

/**
 * Pseudo access flag to distinguish between the synthetic attribute and the
 * synthetic access flag.
 */
export const ACC_SYNTHETIC_ATTRIBUTE = 262144

/**
 * Factor to convert from ACC_SYNTHETIC_ATTRIBUTE to Opcode.ACC_SYNTHETIC.
 */
export const TO_ACC_SYNTHETIC: number = (ACC_SYNTHETIC_ATTRIBUTE / Opcodes.ACC_SYNTHETIC) | 0
export const TO_ACC_SYNTHETIC_$LI$ = (): number => {
  return TO_ACC_SYNTHETIC
}

/**
 * The type of instructions without any argument.
 */
export const NOARG_INSN = 0

/**
 * The type of instructions with an signed byte argument.
 */
export const SBYTE_INSN = 1

/**
 * The type of instructions with an signed short argument.
 */
export const SHORT_INSN = 2

/**
 * The type of instructions with a local variable index argument.
 */
export const VAR_INSN = 3

/**
 * The type of instructions with an implicit local variable index argument.
 */
export const IMPLVAR_INSN = 4

/**
 * The type of instructions with a type descriptor argument.
 */
export const TYPE_INSN = 5

/**
 * The type of field and method invocations instructions.
 */
export const FIELDORMETH_INSN = 6

/**
 * The type of the INVOKEINTERFACE/INVOKEDYNAMIC instruction.
 */
export const ITFMETH_INSN = 7

/**
 * The type of the INVOKEDYNAMIC instruction.
 */
export const INDYMETH_INSN = 8

/**
 * The type of instructions with a 2 bytes bytecode offset label.
 */
export const LABEL_INSN = 9

/**
 * The type of instructions with a 4 bytes bytecode offset label.
 */
export const LABELW_INSN = 10

/**
 * The type of the LDC instruction.
 */
export const LDC_INSN = 11

/**
 * The type of the LDC_W and LDC2_W instructions.
 */
export const LDCW_INSN = 12

/**
 * The type of the IINC instruction.
 */
export const IINC_INSN = 13

/**
 * The type of the TABLESWITCH instruction.
 */
export const TABL_INSN = 14

/**
 * The type of the LOOKUPSWITCH instruction.
 */
export const LOOK_INSN = 15

/**
 * The type of the MULTIANEWARRAY instruction.
 */
export const MANA_INSN = 16

/**
 * The type of the WIDE instruction.
 */
export const WIDE_INSN = 17

/**
 * The type of the ASM pseudo instructions with an unsigned 2 bytes offset
 * label (see Label#resolve).
 */
export const ASM_LABEL_INSN = 18

/**
 * Represents a frame inserted between already existing frames. This kind of
 * frame can only be used if the frame content can be computed from the
 * previous existing frame and from the instructions between this existing
 * frame and the inserted one, without any knowledge of the type hierarchy.
 * This kind of frame is only used when an unconditional jump is inserted in
 * a method while expanding an ASM pseudo instruction (see ClassReader).
 */
export const F_INSERT = 256

/**
 * The instruction types of all JVM opcodes.
 */
export const TYPE: number[] = (() => {
  let i: number
  const b: number[] = new Array(220)
  const s =
    'AAAAAAAAAAAAAAAABCLMMDDDDDEEEEEEEEEEEEEEEEEEEEAAAAAAAADDDDDEEEEEEEEEEEEEEEEEEEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANAAAAAAAAAAAAAAAAAAAAJJJJJJJJJJJJJJJJDOPAAAAAAGGGGGGGHIFBFAAFFAARQJJKKSSSSSSSSSSSSSSSSSS'
  for (i = 0; i < b.length; ++i) {
    b[i] = (s.charAt(i).charCodeAt(0) - 'A'.charCodeAt(0)) | 0
  }
  return b
})()

/**
 * The type of CONSTANT_Class constant pool items.
 */
export const CLASS = 7

/**
 * The type of CONSTANT_Fieldref constant pool items.
 */
export const FIELD = 9

/**
 * The type of CONSTANT_Methodref constant pool items.
 */
export const METH = 10

/**
 * The type of CONSTANT_InterfaceMethodref constant pool items.
 */
export const IMETH = 11

/**
 * The type of CONSTANT_String constant pool items.
 */
export const STR = 8

/**
 * The type of CONSTANT_Integer constant pool items.
 */
export const INT = 3

/**
 * The type of CONSTANT_Float constant pool items.
 */
export const FLOAT = 4

/**
 * The type of CONSTANT_Long constant pool items.
 */
export const LONG = 5

/**
 * The type of CONSTANT_Double constant pool items.
 */
export const DOUBLE = 6

/**
 * The type of CONSTANT_NameAndType constant pool items.
 */
export const NAME_TYPE = 12

/**
 * The type of CONSTANT_Utf8 constant pool items.
 */
export const UTF8 = 1

/**
 * The type of CONSTANT_MethodType constant pool items.
 */
export const MTYPE = 16

/**
 * The type of CONSTANT_MethodHandle constant pool items.
 */
export const HANDLE = 15

/**
 * The type of CONSTANT_InvokeDynamic constant pool items.
 */
export const INDY = 18

/**
 * The base value for all CONSTANT_MethodHandle constant pool items.
 * Internally, ASM store the 9 variations of CONSTANT_MethodHandle into 9
 * different items.
 */
export const HANDLE_BASE = 20

/**
 * Normal type Item stored in the ClassWriter {@link ClassWriter#typeTable},
 * instead of the constant pool, in order to avoid clashes with normal
 * constant pool items in the ClassWriter constant pool's hash table.
 */
export const TYPE_NORMAL = 30

/**
 * Uninitialized type Item stored in the ClassWriter
 * {@link ClassWriter#typeTable}, instead of the constant pool, in order to
 * avoid clashes with normal constant pool items in the ClassWriter constant
 * pool's hash table.
 */
export const TYPE_UNINIT = 31

/**
 * Merged type Item stored in the ClassWriter {@link ClassWriter#typeTable},
 * instead of the constant pool, in order to avoid clashes with normal
 * constant pool items in the ClassWriter constant pool's hash table.
 */
export const TYPE_MERGED = 32

/**
 * The type of BootstrapMethods items. These items are stored in a special
 * class attribute named BootstrapMethods and not in the constant pool.
 */
export const BSM = 33
