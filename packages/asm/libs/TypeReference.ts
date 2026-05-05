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
 * A reference to a type appearing in a class, field or method declaration, or
 * on an instruction. Such a reference designates the part of the class where
 * the referenced type is appearing (e.g. an 'extends', 'implements' or 'throws'
 * clause, a 'new' instruction, a 'catch' clause, a type cast, a local variable
 * declaration, etc).
 *
 * @author Eric Bruneton
 */
export class TypeReference {
  /**
   * The sort of type references that target a type parameter of a generic
   * class. See {@link #getSort getSort}.
   */
  static readonly CLASS_TYPE_PARAMETER: number = 0

  /**
   * The sort of type references that target a type parameter of a generic
   * method. See {@link #getSort getSort}.
   */
  static readonly METHOD_TYPE_PARAMETER: number = 1

  /**
   * The sort of type references that target the super class of a class or one
   * of the interfaces it implements. See {@link #getSort getSort}.
   */
  static readonly CLASS_EXTENDS: number = 16

  /**
   * The sort of type references that target a bound of a type parameter of a
   * generic class. See {@link #getSort getSort}.
   */
  static readonly CLASS_TYPE_PARAMETER_BOUND: number = 17

  /**
   * The sort of type references that target a bound of a type parameter of a
   * generic method. See {@link #getSort getSort}.
   */
  static readonly METHOD_TYPE_PARAMETER_BOUND: number = 18

  /**
   * The sort of type references that target the type of a field. See
   * {@link #getSort getSort}.
   */
  static readonly FIELD: number = 19

  /**
   * The sort of type references that target the return type of a method. See
   * {@link #getSort getSort}.
   */
  static readonly METHOD_RETURN: number = 20

  /**
   * The sort of type references that target the receiver type of a method.
   * See {@link #getSort getSort}.
   */
  static readonly METHOD_RECEIVER: number = 21

  /**
   * The sort of type references that target the type of a formal parameter of
   * a method. See {@link #getSort getSort}.
   */
  static readonly METHOD_FORMAL_PARAMETER: number = 22

  /**
   * The sort of type references that target the type of an exception declared
   * in the throws clause of a method. See {@link #getSort getSort}.
   */
  static readonly THROWS: number = 23

  /**
   * The sort of type references that target the type of a local variable in a
   * method. See {@link #getSort getSort}.
   */
  static readonly LOCAL_VARIABLE: number = 64

  /**
   * The sort of type references that target the type of a resource variable
   * in a method. See {@link #getSort getSort}.
   */
  static readonly RESOURCE_VARIABLE: number = 65

  /**
   * The sort of type references that target the type of the exception of a
   * 'catch' clause in a method. See {@link #getSort getSort}.
   */
  static readonly EXCEPTION_PARAMETER: number = 66

  /**
   * The sort of type references that target the type declared in an
   * 'instanceof' instruction. See {@link #getSort getSort}.
   */
  static readonly INSTANCEOF: number = 67

  /**
   * The sort of type references that target the type of the object created by
   * a 'new' instruction. See {@link #getSort getSort}.
   */
  static readonly NEW: number = 68

  /**
   * The sort of type references that target the receiver type of a
   * constructor reference. See {@link #getSort getSort}.
   */
  static readonly CONSTRUCTOR_REFERENCE: number = 69

  /**
   * The sort of type references that target the receiver type of a method
   * reference. See {@link #getSort getSort}.
   */
  static readonly METHOD_REFERENCE: number = 70

  /**
   * The sort of type references that target the type declared in an explicit
   * or implicit cast instruction. See {@link #getSort getSort}.
   */
  static readonly CAST: number = 71

  /**
   * The sort of type references that target a type parameter of a generic
   * constructor in a constructor call. See {@link #getSort getSort}.
   */
  static readonly CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT: number = 72

  /**
   * The sort of type references that target a type parameter of a generic
   * method in a method call. See {@link #getSort getSort}.
   */
  static readonly METHOD_INVOCATION_TYPE_ARGUMENT: number = 73

  /**
   * The sort of type references that target a type parameter of a generic
   * constructor in a constructor reference. See {@link #getSort getSort}.
   */
  static readonly CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT: number = 74

  /**
   * The sort of type references that target a type parameter of a generic
   * method in a method reference. See {@link #getSort getSort}.
   */
  static readonly METHOD_REFERENCE_TYPE_ARGUMENT: number = 75

  /**
   * The type reference value in Java class file format.
   */
  private value: number

  /**
   * Creates a new TypeReference.
   *
   * @param typeRef
   * the int encoded value of the type reference, as received in a
   * visit method related to type annotations, like
   * visitTypeAnnotation.
   */
  constructor(typeRef: number) {
    this.value = 0
    this.value = typeRef
  }

  /**
   * Returns a type reference of the given sort.
   *
   * @param sort
   * {@link #FIELD FIELD}, {@link #METHOD_RETURN METHOD_RETURN},
   * {@link #METHOD_RECEIVER METHOD_RECEIVER},
   * {@link #LOCAL_VARIABLE LOCAL_VARIABLE},
   * {@link #RESOURCE_VARIABLE RESOURCE_VARIABLE},
   * {@link #INSTANCEOF INSTANCEOF}, {@link #NEW NEW},
   * {@link #CONSTRUCTOR_REFERENCE CONSTRUCTOR_REFERENCE}, or
   * {@link #METHOD_REFERENCE METHOD_REFERENCE}.
   * @return a type reference of the given sort.
   */
  static newTypeReference(sort: number): TypeReference {
    return new TypeReference(sort << 24)
  }

  /**
   * Returns a reference to a type parameter of a generic class or method.
   *
   * @param sort
   * {@link #CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER} or
   * {@link #METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER}.
   * @param paramIndex
   * the type parameter index.
   * @return a reference to the given generic class or method type parameter.
   */
  static newTypeParameterReference(sort: number, paramIndex: number): TypeReference {
    return new TypeReference((sort << 24) | (paramIndex << 16))
  }

  /**
   * Returns a reference to a type parameter bound of a generic class or
   * method.
   *
   * @param sort
   * {@link #CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER} or
   * {@link #METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER}.
   * @param paramIndex
   * the type parameter index.
   * @param boundIndex
   * the type bound index within the above type parameters.
   * @return a reference to the given generic class or method type parameter
   * bound.
   */
  static newTypeParameterBoundReference(
    sort: number,
    paramIndex: number,
    boundIndex: number,
  ): TypeReference {
    return new TypeReference((sort << 24) | (paramIndex << 16) | (boundIndex << 8))
  }

  /**
   * Returns a reference to the super class or to an interface of the
   * 'implements' clause of a class.
   *
   * @param itfIndex
   * the index of an interface in the 'implements' clause of a
   * class, or -1 to reference the super class of the class.
   * @return a reference to the given super type of a class.
   */
  static newSuperTypeReference(itfIndex: number): TypeReference {
    itfIndex &= 65535
    return new TypeReference((TypeReference.CLASS_EXTENDS << 24) | (itfIndex << 8))
  }

  /**
   * Returns a reference to the type of a formal parameter of a method.
   *
   * @param paramIndex
   * the formal parameter index.
   *
   * @return a reference to the type of the given method formal parameter.
   */
  static newFormalParameterReference(paramIndex: number): TypeReference {
    return new TypeReference((TypeReference.METHOD_FORMAL_PARAMETER << 24) | (paramIndex << 16))
  }

  /**
   * Returns a reference to the type of an exception, in a 'throws' clause of
   * a method.
   *
   * @param exceptionIndex
   * the index of an exception in a 'throws' clause of a method.
   *
   * @return a reference to the type of the given exception.
   */
  static newExceptionReference(exceptionIndex: number): TypeReference {
    return new TypeReference((TypeReference.THROWS << 24) | (exceptionIndex << 8))
  }

  /**
   * Returns a reference to the type of the exception declared in a 'catch'
   * clause of a method.
   *
   * @param tryCatchBlockIndex
   * the index of a try catch block (using the order in which they
   * are visited with visitTryCatchBlock).
   *
   * @return a reference to the type of the given exception.
   */
  static newTryCatchReference(tryCatchBlockIndex: number): TypeReference {
    return new TypeReference((TypeReference.EXCEPTION_PARAMETER << 24) | (tryCatchBlockIndex << 8))
  }

  /**
   * Returns a reference to the type of a type argument in a constructor or
   * method call or reference.
   *
   * @param sort
   * {@link #CAST CAST},
   * {@link #CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT
   * CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT},
   * {@link #METHOD_INVOCATION_TYPE_ARGUMENT
   * METHOD_INVOCATION_TYPE_ARGUMENT},
   * {@link #CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT
   * CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT}, or
   * {@link #METHOD_REFERENCE_TYPE_ARGUMENT
   * METHOD_REFERENCE_TYPE_ARGUMENT}.
   * @param argIndex
   * the type argument index.
   *
   * @return a reference to the type of the given type argument.
   */
  static newTypeArgumentReference(sort: number, argIndex: number): TypeReference {
    return new TypeReference((sort << 24) | argIndex)
  }

  /**
   * Returns the sort of this type reference.
   *
   * @return {@link #CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER},
   * {@link #METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER},
   * {@link #CLASS_EXTENDS CLASS_EXTENDS},
   * {@link #CLASS_TYPE_PARAMETER_BOUND CLASS_TYPE_PARAMETER_BOUND},
   * {@link #METHOD_TYPE_PARAMETER_BOUND METHOD_TYPE_PARAMETER_BOUND},
   * {@link #FIELD FIELD}, {@link #METHOD_RETURN METHOD_RETURN},
   * {@link #METHOD_RECEIVER METHOD_RECEIVER},
   * {@link #METHOD_FORMAL_PARAMETER METHOD_FORMAL_PARAMETER},
   * {@link #THROWS THROWS}, {@link #LOCAL_VARIABLE LOCAL_VARIABLE},
   * {@link #RESOURCE_VARIABLE RESOURCE_VARIABLE},
   * {@link #EXCEPTION_PARAMETER EXCEPTION_PARAMETER},
   * {@link #INSTANCEOF INSTANCEOF}, {@link #NEW NEW},
   * {@link #CONSTRUCTOR_REFERENCE CONSTRUCTOR_REFERENCE},
   * {@link #METHOD_REFERENCE METHOD_REFERENCE}, {@link #CAST CAST},
   * {@link #CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT
   * CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT},
   * {@link #METHOD_INVOCATION_TYPE_ARGUMENT
   * METHOD_INVOCATION_TYPE_ARGUMENT},
   * {@link #CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT
   * CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT}, or
   * {@link #METHOD_REFERENCE_TYPE_ARGUMENT
   * METHOD_REFERENCE_TYPE_ARGUMENT}.
   */
  getSort(): number {
    return this.value >>> 24
  }

  /**
   * Returns the index of the type parameter referenced by this type
   * reference. This method must only be used for type references whose sort
   * is {@link #CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER},
   * {@link #METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER},
   * {@link #CLASS_TYPE_PARAMETER_BOUND CLASS_TYPE_PARAMETER_BOUND} or
   * {@link #METHOD_TYPE_PARAMETER_BOUND METHOD_TYPE_PARAMETER_BOUND}.
   *
   * @return a type parameter index.
   */
  getTypeParameterIndex(): number {
    return (this.value & 16711680) >> 16
  }

  /**
   * Returns the index of the type parameter bound, within the type parameter
   * {@link #getTypeParameterIndex}, referenced by this type reference. This
   * method must only be used for type references whose sort is
   * {@link #CLASS_TYPE_PARAMETER_BOUND CLASS_TYPE_PARAMETER_BOUND} or
   * {@link #METHOD_TYPE_PARAMETER_BOUND METHOD_TYPE_PARAMETER_BOUND}.
   *
   * @return a type parameter bound index.
   */
  getTypeParameterBoundIndex(): number {
    return (this.value & 65280) >> 8
  }

  /**
   * Returns the index of the "super type" of a class that is referenced by
   * this type reference. This method must only be used for type references
   * whose sort is {@link #CLASS_EXTENDS CLASS_EXTENDS}.
   *
   * @return the index of an interface in the 'implements' clause of a class,
   * or -1 if this type reference references the type of the super
   * class.
   */
  getSuperTypeIndex(): number {
    return ((this.value & 16776960) >> 8) | 0
  }

  /**
   * Returns the index of the formal parameter whose type is referenced by
   * this type reference. This method must only be used for type references
   * whose sort is {@link #METHOD_FORMAL_PARAMETER METHOD_FORMAL_PARAMETER}.
   *
   * @return a formal parameter index.
   */
  getFormalParameterIndex(): number {
    return (this.value & 16711680) >> 16
  }

  /**
   * Returns the index of the exception, in a 'throws' clause of a method,
   * whose type is referenced by this type reference. This method must only be
   * used for type references whose sort is {@link #THROWS THROWS}.
   *
   * @return the index of an exception in the 'throws' clause of a method.
   */
  getExceptionIndex(): number {
    return (this.value & 16776960) >> 8
  }

  /**
   * Returns the index of the try catch block (using the order in which they
   * are visited with visitTryCatchBlock), whose 'catch' type is referenced by
   * this type reference. This method must only be used for type references
   * whose sort is {@link #EXCEPTION_PARAMETER EXCEPTION_PARAMETER} .
   *
   * @return the index of an exception in the 'throws' clause of a method.
   */
  getTryCatchBlockIndex(): number {
    return (this.value & 16776960) >> 8
  }

  /**
   * Returns the index of the type argument referenced by this type reference.
   * This method must only be used for type references whose sort is
   * {@link #CAST CAST}, {@link #CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT
   * CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT},
   * {@link #METHOD_INVOCATION_TYPE_ARGUMENT METHOD_INVOCATION_TYPE_ARGUMENT},
   * {@link #CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT
   * CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT}, or
   * {@link #METHOD_REFERENCE_TYPE_ARGUMENT METHOD_REFERENCE_TYPE_ARGUMENT}.
   *
   * @return a type parameter index.
   */
  getTypeArgumentIndex(): number {
    return this.value & 255
  }

  /**
   * Returns the int encoded value of this type reference, suitable for use in
   * visit methods related to type annotations, like visitTypeAnnotation.
   *
   * @return the int encoded value of this type reference.
   */
  getValue(): number {
    return this.value
  }
}
