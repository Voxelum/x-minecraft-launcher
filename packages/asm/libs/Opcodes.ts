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
 * Defines the JVM opcodes, access flags and array type codes. This interface
 * does not define all the JVM opcodes because some opcodes are automatically
 * handled. For example, the xLOAD and xSTORE opcodes are automatically replaced
 * by xLOAD_n and xSTORE_n opcodes when possible. The xLOAD_n and xSTORE_n
 * opcodes are therefore not defined in this interface. Likewise for LDC,
 * automatically replaced by LDC_W or LDC2_W when necessary, WIDE, GOTO_W and
 * JSR_W.
 *
 * @author Eric Bruneton
 * @author Eugene Kuleshov
 */
export enum Opcodes {
  ASM4 = (4 << 16) | (0 << 8) | 0,

  ASM5 = (5 << 16) | (0 << 8) | 0,

  V1_1 = (3 << 16) | 45,

  V1_2 = (0 << 16) | 46,

  V1_3 = (0 << 16) | 47,

  V1_4 = (0 << 16) | 48,

  V1_5 = (0 << 16) | 49,

  V1_6 = (0 << 16) | 50,

  V1_7 = (0 << 16) | 51,

  V1_8 = (0 << 16) | 52,

  ACC_PUBLIC = 1,

  ACC_PRIVATE = 2,

  ACC_PROTECTED = 4,

  ACC_STATIC = 8,

  ACC_FINAL = 16,

  ACC_SUPER = 32,

  ACC_SYNCHRONIZED = 32,

  ACC_VOLATILE = 64,

  ACC_BRIDGE = 64,

  ACC_VARARGS = 128,

  ACC_TRANSIENT = 128,

  ACC_NATIVE = 256,

  ACC_INTERFACE = 512,

  ACC_ABSTRACT = 1024,

  ACC_STRICT = 2048,

  ACC_SYNTHETIC = 4096,

  ACC_ANNOTATION = 8192,

  ACC_ENUM = 16384,

  ACC_MANDATED = 32768,

  ACC_DEPRECATED = 131072,

  T_BOOLEAN = 4,

  T_CHAR = 5,

  T_FLOAT = 6,

  T_DOUBLE = 7,

  T_BYTE = 8,

  T_SHORT = 9,

  T_INT = 10,

  T_LONG = 11,

  H_GETFIELD = 1,

  H_GETSTATIC = 2,

  H_PUTFIELD = 3,

  H_PUTSTATIC = 4,

  H_INVOKEVIRTUAL = 5,

  H_INVOKESTATIC = 6,

  H_INVOKESPECIAL = 7,

  H_NEWINVOKESPECIAL = 8,

  H_INVOKEINTERFACE = 9,

  /**
   * Represents an expanded frame. See {@link ClassReader#EXPAND_FRAMES}.
   */
  F_NEW = -1,

  /**
   * Represents a compressed frame with compe frame data.,
   */
  F_FULL = 0,

  /**
   * Represents a compressed frame where locals are the same as the locals in
   * the previous frame, except that additional 1-3 locals are defined, and
   * with an empty stack.
   */
  F_APPEND = 1,

  /**
   * Represents a compressed frame where locals are the same as the locals in
   * the previous frame, except that the last 1-3 locals are absent and with
   * an empty stack.
   */
  F_CHOP = 2,

  /**
   * Represents a compressed frame with exactly the same locals as the
   * previous frame and with an empty stack.
   */
  F_SAME = 3,

  /**
   * Represents a compressed frame with exactly the same locals as the
   * previous frame and with a single value on the stack.
   */
  F_SAME1 = 4,

  TOP = 0,

  INTEGER = 1,

  FLOAT = 2,

  DOUBLE = 3,

  LONG = 4,

  NULL = 5,

  UNINITIALIZED_THIS = 6,

  NOP = 0,

  ACONST_NULL = 1,

  ICONST_M1 = 2,

  ICONST_0 = 3,

  ICONST_1 = 4,

  ICONST_2 = 5,

  ICONST_3 = 6,

  ICONST_4 = 7,

  ICONST_5 = 8,

  LCONST_0 = 9,

  LCONST_1 = 10,

  FCONST_0 = 11,

  FCONST_1 = 12,

  FCONST_2 = 13,

  DCONST_0 = 14,

  DCONST_1 = 15,

  BIPUSH = 16,

  SIPUSH = 17,

  LDC = 18,

  ILOAD = 21,

  LLOAD = 22,

  FLOAD = 23,

  DLOAD = 24,

  ALOAD = 25,

  IALOAD = 46,

  LALOAD = 47,

  FALOAD = 48,

  DALOAD = 49,

  AALOAD = 50,

  BALOAD = 51,

  CALOAD = 52,

  SALOAD = 53,

  ISTORE = 54,

  LSTORE = 55,

  FSTORE = 56,

  DSTORE = 57,

  ASTORE = 58,

  IASTORE = 79,

  LASTORE = 80,

  FASTORE = 81,

  DASTORE = 82,

  AASTORE = 83,

  BASTORE = 84,

  CASTORE = 85,

  SASTORE = 86,

  POP = 87,

  POP2 = 88,

  DUP = 89,

  DUP_X1 = 90,

  DUP_X2 = 91,

  DUP2 = 92,

  DUP2_X1 = 93,

  DUP2_X2 = 94,

  SWAP = 95,

  IADD = 96,

  LADD = 97,

  FADD = 98,

  DADD = 99,

  ISUB = 100,

  LSUB = 101,

  FSUB = 102,

  DSUB = 103,

  IMUL = 104,

  LMUL = 105,

  FMUL = 106,

  DMUL = 107,

  IDIV = 108,

  LDIV = 109,

  FDIV = 110,

  DDIV = 111,

  IREM = 112,

  LREM = 113,

  FREM = 114,

  DREM = 115,

  INEG = 116,

  LNEG = 117,

  FNEG = 118,

  DNEG = 119,

  ISHL = 120,

  LSHL = 121,

  ISHR = 122,

  LSHR = 123,

  IUSHR = 124,

  LUSHR = 125,

  IAND = 126,

  LAND = 127,

  IOR = 128,

  LOR = 129,

  IXOR = 130,

  LXOR = 131,

  IINC = 132,

  I2L = 133,

  I2F = 134,

  I2D = 135,

  L2I = 136,

  L2F = 137,

  L2D = 138,

  F2I = 139,

  F2L = 140,

  F2D = 141,

  D2I = 142,

  D2L = 143,

  D2F = 144,

  I2B = 145,

  I2C = 146,

  I2S = 147,

  LCMP = 148,

  FCMPL = 149,

  FCMPG = 150,

  DCMPL = 151,

  DCMPG = 152,

  IFEQ = 153,

  IFNE = 154,

  IFLT = 155,

  IFGE = 156,

  IFGT = 157,

  IFLE = 158,

  IF_ICMPEQ = 159,

  IF_ICMPNE = 160,

  IF_ICMPLT = 161,

  IF_ICMPGE = 162,

  IF_ICMPGT = 163,

  IF_ICMPLE = 164,

  IF_ACMPEQ = 165,

  IF_ACMPNE = 166,

  GOTO = 167,

  JSR = 168,

  RET = 169,

  TABLESWITCH = 170,

  LOOKUPSWITCH = 171,

  IRETURN = 172,

  LRETURN = 173,

  FRETURN = 174,

  DRETURN = 175,

  ARETURN = 176,

  RETURN = 177,

  GETSTATIC = 178,

  PUTSTATIC = 179,

  GETFIELD = 180,

  PUTFIELD = 181,

  INVOKEVIRTUAL = 182,

  INVOKESPECIAL = 183,

  INVOKESTATIC = 184,

  INVOKEINTERFACE = 185,

  INVOKEDYNAMIC = 186,

  NEW = 187,

  NEWARRAY = 188,

  ANEWARRAY = 189,

  ARRAYLENGTH = 190,

  ATHROW = 191,

  CHECKCAST = 192,

  INSTANCEOF = 193,

  MONITORENTER = 194,

  MONITOREXIT = 195,

  MULTIANEWARRAY = 197,

  IFNULL = 198,

  IFNONNULL = 199,
}
