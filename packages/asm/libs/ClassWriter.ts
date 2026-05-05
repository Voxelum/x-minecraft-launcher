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
import { AnnotationWriter } from './AnnotationWriter'
import { AnnotationVisitor } from './AnnotationVisitor'
import type { Attribute } from './Attribute'
import * as ClassWriterConstant from './ClassWriterConstant'
import { ByteVector } from './ByteVector'
import { ClassReader } from './ClassReader'
import { ClassVisitor } from './ClassVisitor'
import { FieldVisitor } from './FieldVisitor'
import { FieldWriter } from './FieldWriter'
import { Handle } from './Handle'
import { Item } from './Item'
import type { MethodVisitor } from './MethodVisitor'
import { MethodWriter } from './MethodWriter'
import { Opcodes } from './Opcodes'
import { TypePath } from './TypePath'
import { SIGNATURES } from './ClassReaderConstant'

export class ClassWriter extends ClassVisitor {
  /**
   * The class reader from which this class writer was constructed, if any.
   */
  cr: ClassReader

  /**
   * Minor and major version numbers of the class to be generated.
   */
  version: number

  /**
   * Index of the next item to be added in the constant pool.
   */
  index: number

  /**
   * The constant pool of this class.
   */
  pool: ByteVector

  /**
   * The constant pool's hash table data.
   */
  items: Item[]

  /**
   * The threshold of the constant pool's hash table.
   */
  threshold: number

  /**
   * A reusable key used to look for items in the {@link #items} hash table.
   */
  key: Item

  /**
   * A reusable key used to look for items in the {@link #items} hash table.
   */
  key2: Item

  /**
   * A reusable key used to look for items in the {@link #items} hash table.
   */
  key3: Item

  /**
   * A reusable key used to look for items in the {@link #items} hash table.
   */
  key4: Item

  /**
   * A type table used to temporarily store internal names that will not
   * necessarily be stored in the constant pool. This type table is used by
   * the control flow and data flow analysis algorithm used to compute stack
   * map frames from scratch. This array associates to each index <tt>i</tt>
   * the Item whose index is <tt>i</tt>. All Item objects stored in this array
   * are also stored in the {@link #items} hash table. These two arrays allow
   * to retrieve an Item from its index or, conversely, to get the index of an
   * Item from its value. Each Item stores an internal name in its
   * {@link Item#strVal1} field.
   */
  typeTable: Item[]

  /**
   * Number of elements in the {@link #typeTable} array.
   */
  private typeCount: number

  /**
   * The access flags of this class.
   */
  private access: number

  /**
   * The constant pool item that contains the internal name of this class.
   */
  private name: number

  /**
   * The internal name of this class.
   */
  thisName: string

  /**
   * The constant pool item that contains the signature of this class.
   */
  private signature: number

  /**
   * The constant pool item that contains the internal name of the super class
   * of this class.
   */
  private superName: number

  /**
   * Number of interfaces implemented or extended by this class or interface.
   */
  private interfaceCount: number

  /**
   * The interfaces implemented or extended by this class or interface. More
   * precisely, this array contains the indexes of the constant pool items
   * that contain the internal names of these interfaces.
   */
  private interfaces: number[]

  /**
   * The index of the constant pool item that contains the name of the source
   * file from which this class was compiled.
   */
  private sourceFile: number

  /**
   * The SourceDebug attribute of this class.
   */
  private sourceDebug: ByteVector

  /**
   * The constant pool item that contains the name of the enclosing class of
   * this class.
   */
  private enclosingMethodOwner: number

  /**
   * The constant pool item that contains the name and descriptor of the
   * enclosing method of this class.
   */
  private enclosingMethod: number

  /**
   * The runtime visible annotations of this class.
   */
  private anns: AnnotationWriter

  /**
   * The runtime invisible annotations of this class.
   */
  private ianns: AnnotationWriter

  /**
   * The runtime visible type annotations of this class.
   */
  private tanns: AnnotationWriter

  /**
   * The runtime invisible type annotations of this class.
   */
  private itanns: AnnotationWriter

  /**
   * The non standard attributes of this class.
   */
  private attrs: Attribute

  /**
   * The number of entries in the InnerClasses attribute.
   */
  private innerClassesCount: number

  /**
   * The InnerClasses attribute.
   */
  private innerClasses: ByteVector

  /**
   * The number of entries in the BootstrapMethods attribute.
   */
  bootstrapMethodsCount: number

  /**
   * The BootstrapMethods attribute.
   */
  bootstrapMethods: ByteVector

  /**
   * The fields of this class. These fields are stored in a linked list of
   * {@link FieldWriter} objects, linked to each other by their
   * {@link FieldWriter#fv} field. This field stores the first element of this
   * list.
   */
  firstField: FieldWriter

  /**
   * The fields of this class. These fields are stored in a linked list of
   * {@link FieldWriter} objects, linked to each other by their
   * {@link FieldWriter#fv} field. This field stores the last element of this
   * list.
   */
  lastField: FieldWriter

  /**
   * The methods of this class. These methods are stored in a linked list of
   * {@link MethodWriter} objects, linked to each other by their
   * {@link MethodWriter#mv} field. This field stores the first element of
   * this list.
   */
  firstMethod: MethodWriter

  /**
   * The methods of this class. These methods are stored in a linked list of
   * {@link MethodWriter} objects, linked to each other by their
   * {@link MethodWriter#mv} field. This field stores the last element of this
   * list.
   */
  lastMethod: MethodWriter

  /**
   * Indicates what must be automatically computed.
   *
   * @see MethodWriter#compute
   */
  private compute: number

  /**
   * <tt>true</tt> if some methods have wide forward jumps using ASM pseudo
   * instructions, which need to be expanded into sequences of standard
   * bytecode instructions. In this case the class is re-read and re-written
   * with a ClassReader -> ClassWriter chain to perform this transformation.
   */
  hasAsmInsns: boolean

  /**
   * Constructs a new {@link ClassWriter} object and enables optimizations for
   * "mostly add" bytecode transformations. These optimizations are the
   * following:
   *
   * <ul>
   * <li>The constant pool from the original class is copied as is in the new
   * class, which saves time. New constant pool entries will be added at the
   * end if necessary, but unused constant pool entries <i>won't be
   * removed</i>.</li>
   * <li>Methods that are not transformed are copied as is in the new class,
   * directly from the original class bytecode (i.e. without emitting visit
   * events for all the method instructions), which saves a <i>lot</i> of
   * time. Untransformed methods are detected by the fact that the
   * {@link ClassReader} receives {@link MethodVisitor} objects that come from
   * a {@link ClassWriter} (and not from any other {@link ClassVisitor}
   * instance).</li>
   * </ul>
   *
   * @param classReader
   * the {@link ClassReader} used to read the original class. It
   * will be used to copy the entire constant pool from the
   * original class and also to copy other fragments of original
   * bytecode where applicable.
   * @param flags
   * option flags that can be used to modify the default behavior
   * of this class. <i>These option flags do not affect methods
   * that are copied as is in the new class. This means that
   * neither the maximum stack size nor the stack frames will be
   * computed for these methods</i>. See {@link #COMPUTE_MAXS},
   * {@link #COMPUTE_FRAMES}.
   */
  public constructor(classReader?: any, flags?: any) {
    if (
      ((classReader != null && classReader instanceof ClassReader) || classReader === null) &&
      (typeof flags === 'number' || flags === null)
    ) {
      const __args = Array.prototype.slice.call(arguments)
      {
        throw new Error('not supported')

        // let __args = Array.prototype.slice.call(arguments);
        // super(Opcodes.ASM5);
        // this.version = 0;
        // this.index = 0;
        // this.threshold = 0;
        // this.typeCount = 0;
        // this.access = 0;
        // this.name = 0;
        // this.signature = 0;
        // this.superName = 0;
        // this.interfaceCount = 0;
        // this.sourceFile = 0;
        // this.enclosingMethodOwner = 0;
        // this.enclosingMethod = 0;
        // this.innerClassesCount = 0;
        // this.bootstrapMethodsCount = 0;
        // this.compute = 0;
        // this.hasAsmInsns = false;
        // (() => {
        //     this.index = 1;
        //     this.pool = new ByteVector();
        //     this.items = new Array(256);
        //     this.threshold = (<number>(0.75 * this.items.length) | 0);
        //     // this.key = new Item();
        //     // this.key2 = new Item();
        //     // this.key3 = new Item();
        //     // this.key4 = new Item();
        //     this.compute = (flags & ClassWriterConstant.COMPUTE_FRAMES) !== 0 ? MethodWriter.FRAMES : ((flags & ClassWriterConstant.COMPUTE_MAXS) !== 0 ? MethodWriter.MAXS : MethodWriter.NOTHING);
        // })();
      }
      // (() => {
      //     classReader.copyPool(this);
      //     this.cr = classReader;
      // })();
    } else if ((typeof classReader === 'number' || classReader === null) && flags === undefined) {
      const __args = Array.prototype.slice.call(arguments)
      const flags: any = __args[0]
      super(Opcodes.ASM5)
      this.version = 0
      this.index = 0
      this.threshold = 0
      this.typeCount = 0
      this.access = 0
      this.name = 0
      this.signature = 0
      this.superName = 0
      this.interfaceCount = 0
      this.sourceFile = 0
      this.enclosingMethodOwner = 0
      this.enclosingMethod = 0
      this.innerClassesCount = 0
      this.bootstrapMethodsCount = 0
      this.compute = 0
      this.hasAsmInsns = false
      ;(() => {
        this.index = 1
        this.pool = new ByteVector()
        this.items = new Array(256)
        this.threshold = (0.75 * this.items.length) | 0
        // this.key = new Item();
        // this.key2 = new Item();
        // this.key3 = new Item();
        // this.key4 = new Item();
        this.compute =
          (flags & ClassWriterConstant.COMPUTE_FRAMES) !== 0
            ? MethodWriter.FRAMES
            : (flags & ClassWriterConstant.COMPUTE_MAXS) !== 0
              ? MethodWriter.MAXS
              : MethodWriter.NOTHING
      })()
    } else {
      throw new Error('invalid overload')
    }
  }

  public visit(
    version: number,
    access: number,
    name: string,
    signature: string,
    superName: string,
    interfaces: string[],
  ) {
    this.version = version
    this.access = access
    this.name = this.newClass(name)
    this.thisName = name
    if (SIGNATURES && signature != null) {
      this.signature = this.newUTF8(signature)
    }
    this.superName = superName == null ? 0 : this.newClass(superName)
    if (interfaces != null && interfaces.length > 0) {
      this.interfaceCount = interfaces.length
      this.interfaces = new Array(this.interfaceCount)
      for (let i = 0; i < this.interfaceCount; ++i) {
        this.interfaces[i] = this.newClass(interfaces[i])
      }
    }
  }

  public visitSource(file: string, debug: string) {
    throw new Error('not supported')
    // if (file != null) {
    //     this.sourceFile = this.newUTF8(file);
    // }
    // if (debug != null) {
    //     this.sourceDebug = new ByteVector().encodeUTF8(debug, 0, javaemul.internal.IntegerHelper.MAX_VALUE);
    // }
  }

  public visitOuterClass(owner: string, name: string, desc: string) {
    this.enclosingMethodOwner = this.newClass(owner)
    if (name != null && desc != null) {
      this.enclosingMethod = this.newNameType(name, desc)
    }
  }

  public visitAnnotation(desc: string, visible: boolean): AnnotationVisitor {
    if (!ANNOTATIONS) {
      return null
    }
    const bv: ByteVector = new ByteVector()
    bv.putShort(this.newUTF8(desc)).putShort(0)
    const aw: AnnotationWriter = new AnnotationWriter(this, true, bv, bv, 2)
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
  ): AnnotationVisitor {
    if (!ANNOTATIONS) {
      return null
    }
    const bv: ByteVector = new ByteVector()
    AnnotationWriter.putTarget(typeRef, typePath, bv)
    bv.putShort(this.newUTF8(desc)).putShort(0)
    const aw: AnnotationWriter = new AnnotationWriter(this, true, bv, bv, bv.length - 2)
    if (visible) {
      aw.next = this.tanns
      this.tanns = aw
    } else {
      aw.next = this.itanns
      this.itanns = aw
    }
    return aw
  }

  public visitAttribute(attr: Attribute) {
    attr.next = this.attrs
    this.attrs = attr
  }

  public visitInnerClass(name: string, outerName: string, innerName: string, access: number) {
    if (this.innerClasses == null) {
      this.innerClasses = new ByteVector()
    }
    const nameItem: Item = this.newClassItem(name)
    if (nameItem.intVal === 0) {
      ++this.innerClassesCount
      this.innerClasses.putShort(nameItem.index)
      this.innerClasses.putShort(outerName == null ? 0 : this.newClass(outerName))
      this.innerClasses.putShort(innerName == null ? 0 : this.newUTF8(innerName))
      this.innerClasses.putShort(access)
      nameItem.intVal = this.innerClassesCount
    } else {
    }
  }

  public visitField(
    access: number,
    name: string,
    desc: string,
    signature: string,
    value: any,
  ): FieldVisitor {
    return new FieldWriter(this, access, name, desc, signature, value)
  }

  public visitMethod(
    access: number,
    name: string,
    desc: string,
    signature: string,
    exceptions: string[],
  ): MethodVisitor {
    return new MethodWriter(this, access, name, desc, signature, exceptions, this.compute)
  }

  public visitEnd() {}

  /**
   * Returns the bytecode of the class that was build with this class writer.
   *
   * @return the bytecode of the class that was build with this class writer.
   */
  public toByteArray(): number[] {
    // if (this.index > 65535) {
    //     throw new Error("Class file too large!");
    // }
    // let size: number = 24 + 2 * this.interfaceCount;
    // let nbFields: number = 0;
    // let fb: FieldWriter = this.firstField;
    // while ((fb != null)) {
    //     ++nbFields;
    //     size += fb.getSize();
    //     fb = <FieldWriter>fb.fv;
    // };
    // let nbMethods: number = 0;
    // let mb: MethodWriter = this.firstMethod;
    // while ((mb != null)) {
    //     ++nbMethods;
    //     size += mb.getSize();
    //     mb = <MethodWriter>mb.mv;
    // };
    // let attributeCount: number = 0;
    // if (this.bootstrapMethods != null) {
    //     ++attributeCount;
    //     size += 8 + this.bootstrapMethods.length;
    //     this.newUTF8("BootstrapMethods");
    // }
    // if (ClassReader.SIGNATURES && this.signature !== 0) {
    //     ++attributeCount;
    //     size += 8;
    //     this.newUTF8("Signature");
    // }
    // if (this.sourceFile !== 0) {
    //     ++attributeCount;
    //     size += 8;
    //     this.newUTF8("SourceFile");
    // }
    // if (this.sourceDebug != null) {
    //     ++attributeCount;
    //     size += this.sourceDebug.length + 6;
    //     this.newUTF8("SourceDebugExtension");
    // }
    // if (this.enclosingMethodOwner !== 0) {
    //     ++attributeCount;
    //     size += 10;
    //     this.newUTF8("EnclosingMethod");
    // }
    // if ((this.access & Opcodes.ACC_DEPRECATED) !== 0) {
    //     ++attributeCount;
    //     size += 6;
    //     this.newUTF8("Deprecated");
    // }
    // if ((this.access & Opcodes.ACC_SYNTHETIC) !== 0) {
    //     if ((this.version & 65535) < Opcodes.V1_5 || (this.access & ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE) !== 0) {
    //         ++attributeCount;
    //         size += 6;
    //         this.newUTF8("Synthetic");
    //     }
    // }
    // if (this.innerClasses != null) {
    //     ++attributeCount;
    //     size += 8 + this.innerClasses.length;
    //     this.newUTF8("InnerClasses");
    // }
    // if (ANNOTATIONS && this.anns != null) {
    //     ++attributeCount;
    //     size += 8 + this.anns.getSize();
    //     this.newUTF8("RuntimeVisibleAnnotations");
    // }
    // if (ANNOTATIONS && this.ianns != null) {
    //     ++attributeCount;
    //     size += 8 + this.ianns.getSize();
    //     this.newUTF8("RuntimeInvisibleAnnotations");
    // }
    // if (ANNOTATIONS && this.tanns != null) {
    //     ++attributeCount;
    //     size += 8 + this.tanns.getSize();
    //     this.newUTF8("RuntimeVisibleTypeAnnotations");
    // }
    // if (ANNOTATIONS && this.itanns != null) {
    //     ++attributeCount;
    //     size += 8 + this.itanns.getSize();
    //     this.newUTF8("RuntimeInvisibleTypeAnnotations");
    // }
    // if (this.attrs != null) {
    //     attributeCount += this.attrs.getCount();
    //     size += this.attrs.getSize(this, null, 0, -1, -1);
    // }
    // size += this.pool.length;
    // let out: ByteVector = new ByteVector(size);
    // out.putInt(-889275714).putInt(this.version);
    // out.putShort(this.index).putByteArray(this.pool.data, 0, this.pool.length);
    // let mask: number = Opcodes.ACC_DEPRECATED | ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE | (((this.access & ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE) / ClassWriterConstant.TO_ACC_SYNTHETIC_$LI$() | 0));
    // out.putShort(this.access & ~mask).putShort(this.name).putShort(this.superName);
    // out.putShort(this.interfaceCount);
    // for (let i: number = 0; i < this.interfaceCount; ++i) {
    //     out.putShort(this.interfaces[i]);
    // }
    // out.putShort(nbFields);
    // fb = this.firstField;
    // while ((fb != null)) {
    //     fb.put(out);
    //     fb = <FieldWriter>fb.fv;
    // };
    // out.putShort(nbMethods);
    // mb = this.firstMethod;
    // while ((mb != null)) {
    //     mb.put(out);
    //     mb = <MethodWriter>mb.mv;
    // };
    // out.putShort(attributeCount);
    // if (this.bootstrapMethods != null) {
    //     out.putShort(this.newUTF8("BootstrapMethods"));
    //     out.putInt(this.bootstrapMethods.length + 2).putShort(this.bootstrapMethodsCount);
    //     out.putByteArray(this.bootstrapMethods.data, 0, this.bootstrapMethods.length);
    // }
    // if (ClassReader.SIGNATURES && this.signature !== 0) {
    //     out.putShort(this.newUTF8("Signature")).putInt(2).putShort(this.signature);
    // }
    // if (this.sourceFile !== 0) {
    //     out.putShort(this.newUTF8("SourceFile")).putInt(2).putShort(this.sourceFile);
    // }
    // if (this.sourceDebug != null) {
    //     let len: number = this.sourceDebug.length;
    //     out.putShort(this.newUTF8("SourceDebugExtension")).putInt(len);
    //     out.putByteArray(this.sourceDebug.data, 0, len);
    // }
    // if (this.enclosingMethodOwner !== 0) {
    //     out.putShort(this.newUTF8("EnclosingMethod")).putInt(4);
    //     out.putShort(this.enclosingMethodOwner).putShort(this.enclosingMethod);
    // }
    // if ((this.access & Opcodes.ACC_DEPRECATED) !== 0) {
    //     out.putShort(this.newUTF8("Deprecated")).putInt(0);
    // }
    // if ((this.access & Opcodes.ACC_SYNTHETIC) !== 0) {
    //     if ((this.version & 65535) < Opcodes.V1_5 || (this.access & ClassWriterConstant.ACC_SYNTHETIC_ATTRIBUTE) !== 0) {
    //         out.putShort(this.newUTF8("Synthetic")).putInt(0);
    //     }
    // }
    // if (this.innerClasses != null) {
    //     out.putShort(this.newUTF8("InnerClasses"));
    //     out.putInt(this.innerClasses.length + 2).putShort(this.innerClassesCount);
    //     out.putByteArray(this.innerClasses.data, 0, this.innerClasses.length);
    // }
    // if (ANNOTATIONS && this.anns != null) {
    //     out.putShort(this.newUTF8("RuntimeVisibleAnnotations"));
    //     this.anns.put(out);
    // }
    // if (ANNOTATIONS && this.ianns != null) {
    //     out.putShort(this.newUTF8("RuntimeInvisibleAnnotations"));
    //     this.ianns.put(out);
    // }
    // if (ANNOTATIONS && this.tanns != null) {
    //     out.putShort(this.newUTF8("RuntimeVisibleTypeAnnotations"));
    //     this.tanns.put(out);
    // }
    // if (ANNOTATIONS && this.itanns != null) {
    //     out.putShort(this.newUTF8("RuntimeInvisibleTypeAnnotations"));
    //     this.itanns.put(out);
    // }
    // if (this.attrs != null) {
    //     this.attrs.put(this, null, 0, -1, -1, out);
    // }
    // if (this.hasAsmInsns) {
    //     this.anns = null;
    //     this.ianns = null;
    //     this.attrs = null;
    //     this.innerClassesCount = 0;
    //     this.innerClasses = null;
    //     this.firstField = null;
    //     this.lastField = null;
    //     this.firstMethod = null;
    //     this.lastMethod = null;
    //     this.compute = MethodWriter.INSERTED_FRAMES;
    //     this.hasAsmInsns = false;
    //     new ClassReader(out.data).accept(this, ClassReader.EXPAND_FRAMES | ClassReader.EXPAND_ASM_INSNS);
    //     return this.toByteArray();
    // }
    // return out.data;
    throw new Error('not supported')
  }

  /**
   * Adds a number or string constant to the constant pool of the class being
   * build. Does nothing if the constant pool already contains a similar item.
   *
   * @param cst
   * the value of the constant to be added to the constant pool.
   * This parameter must be an {@link Integer}, a {@link Float}, a
   * {@link Long}, a {@link Double}, a {@link String} or a
   * {@link Type}.
   * @return a new or already existing constant item with the given value.
   */
  newConstItem(cst: any): Item {
    throw new Error('unsupported')
    // if (typeof cst === 'number') {
    //     let val: number = /* intValue */((<number>cst) | 0);
    //     return this.newInteger(val);
    // } else if (typeof cst === 'number') {
    //     let val: number = /* intValue */((<number>cst) | 0);
    //     return this.newInteger(val);
    // } else if (typeof cst === 'string') {
    //     let val: number = ((<string>cst).charValue()).charCodeAt(0);
    //     return this.newInteger(val);
    // } else if (typeof cst === 'number') {
    //     let val: number = /* intValue */((<number>cst) | 0);
    //     return this.newInteger(val);
    // } else if (typeof cst === 'boolean') {
    //     let val: number = (<boolean>cst).booleanValue() ? 1 : 0;
    //     return this.newInteger(val);
    // } else if (typeof cst === 'number') {
    //     let val: number = (<number>cst).floatValue();
    //     return this.newFloat(val);
    // } else if (typeof cst === 'number') {
    //     let val: number = (<number>cst).longValue();
    //     return this.newLong(val);
    // } else if (typeof cst === 'number') {
    //     let val: number = (<number>cst).doubleValue();
    //     return this.newDouble(val);
    // } else if (typeof cst === 'string') {
    //     return this.newString(<string>cst);
    // } else if (cst != null && cst instanceof Type) {
    //     let t: Type = <Type>cst;
    //     let s: number = t.getSort();
    //     if (s === Type.OBJECT) {
    //         return this.newClassItem(t.getInternalName());
    //     } else if (s === Type.METHOD) {
    //         return this.newMethodTypeItem(t.getDescriptor());
    //     } else {
    //         return this.newClassItem(t.getDescriptor());
    //     }
    // } else if (cst != null && cst instanceof Handle) {
    //     let h: Handle = <Handle>cst;
    //     return this.newHandleItem(h.tag, h.owner, h.name, h.desc, h.itf);
    // } else {
    //     throw new Error("value " + cst);
    // }
  }

  /**
   * Adds a number or string constant to the constant pool of the class being
   * build. Does nothing if the constant pool already contains a similar item.
   * <i>This method is intended for {@link Attribute} sub classes, and is
   * normally not needed by class generators or adapters.</i>
   *
   * @param cst
   * the value of the constant to be added to the constant pool.
   * This parameter must be an {@link Integer}, a {@link Float}, a
   * {@link Long}, a {@link Double} or a {@link String}.
   * @return the index of a new or already existing constant item with the
   * given value.
   */
  public newConst(cst: any): number {
    return this.newConstItem(cst).index
  }

  /**
   * Adds an UTF8 string to the constant pool of the class being build. Does
   * nothing if the constant pool already contains a similar item. <i>This
   * method is intended for {@link Attribute} sub classes, and is normally not
   * needed by class generators or adapters.</i>
   *
   * @param value
   * the String value.
   * @return the index of a new or already existing UTF8 item.
   */
  public newUTF8(value: string): number {
    this.key.set(ClassWriterConstant.UTF8, value, null, null)
    let result: Item = this.get(this.key)
    if (result == null) {
      this.pool.putByte(ClassWriterConstant.UTF8).putUTF8(value)
      result = new Item(this.index++, this.key)
      this.put(result)
    }
    return result.index
  }

  /**
   * Adds a class reference to the constant pool of the class being build.
   * Does nothing if the constant pool already contains a similar item.
   * <i>This method is intended for {@link Attribute} sub classes, and is
   * normally not needed by class generators or adapters.</i>
   *
   * @param value
   * the internal name of the class.
   * @return a new or already existing class reference item.
   */
  newClassItem(value: string): Item {
    this.key2.set(ClassWriterConstant.CLASS, value, null, null)
    let result: Item = this.get(this.key2)
    if (result == null) {
      this.pool.put12(ClassWriterConstant.CLASS, this.newUTF8(value))
      result = new Item(this.index++, this.key2)
      this.put(result)
    }
    return result
  }

  /**
   * Adds a class reference to the constant pool of the class being build.
   * Does nothing if the constant pool already contains a similar item.
   * <i>This method is intended for {@link Attribute} sub classes, and is
   * normally not needed by class generators or adapters.</i>
   *
   * @param value
   * the internal name of the class.
   * @return the index of a new or already existing class reference item.
   */
  public newClass(value: string): number {
    return this.newClassItem(value).index
  }

  /**
   * Adds a method type reference to the constant pool of the class being
   * build. Does nothing if the constant pool already contains a similar item.
   * <i>This method is intended for {@link Attribute} sub classes, and is
   * normally not needed by class generators or adapters.</i>
   *
   * @param methodDesc
   * method descriptor of the method type.
   * @return a new or already existing method type reference item.
   */
  newMethodTypeItem(methodDesc: string): Item {
    this.key2.set(ClassWriterConstant.MTYPE, methodDesc, null, null)
    let result: Item = this.get(this.key2)
    if (result == null) {
      this.pool.put12(ClassWriterConstant.MTYPE, this.newUTF8(methodDesc))
      result = new Item(this.index++, this.key2)
      this.put(result)
    }
    return result
  }

  /**
   * Adds a method type reference to the constant pool of the class being
   * build. Does nothing if the constant pool already contains a similar item.
   * <i>This method is intended for {@link Attribute} sub classes, and is
   * normally not needed by class generators or adapters.</i>
   *
   * @param methodDesc
   * method descriptor of the method type.
   * @return the index of a new or already existing method type reference
   * item.
   */
  public newMethodType(methodDesc: string): number {
    return this.newMethodTypeItem(methodDesc).index
  }

  /**
   * Adds a handle to the constant pool of the class being build. Does nothing
   * if the constant pool already contains a similar item. <i>This method is
   * intended for {@link Attribute} sub classes, and is normally not needed by
   * class generators or adapters.</i>
   *
   * @param tag
   * the kind of this handle. Must be {@link Opcodes#H_GETFIELD},
   * {@link Opcodes#H_GETSTATIC}, {@link Opcodes#H_PUTFIELD},
   * {@link Opcodes#H_PUTSTATIC}, {@link Opcodes#H_INVOKEVIRTUAL},
   * {@link Opcodes#H_INVOKESTATIC},
   * {@link Opcodes#H_INVOKESPECIAL},
   * {@link Opcodes#H_NEWINVOKESPECIAL} or
   * {@link Opcodes#H_INVOKEINTERFACE}.
   * @param owner
   * the internal name of the field or method owner class.
   * @param name
   * the name of the field or method.
   * @param desc
   * the descriptor of the field or method.
   * @param itf
   * true if the owner is an interface.
   * @return a new or an already existing method type reference item.
   */
  newHandleItem(tag: number, owner: string, name: string, desc: string, itf: boolean): Item {
    this.key4.set(ClassWriterConstant.HANDLE_BASE + tag, owner, name, desc)
    let result: Item = this.get(this.key4)
    if (result == null) {
      if (tag <= Opcodes.H_PUTSTATIC) {
        this.put112(ClassWriterConstant.HANDLE, tag, this.newField(owner, name, desc))
      } else {
        this.put112(ClassWriterConstant.HANDLE, tag, this.newMethod(owner, name, desc, itf))
      }
      result = new Item(this.index++, this.key4)
      this.put(result)
    }
    return result
  }

  /**
   * Adds a handle to the constant pool of the class being build. Does nothing
   * if the constant pool already contains a similar item. <i>This method is
   * intended for {@link Attribute} sub classes, and is normally not needed by
   * class generators or adapters.</i>
   *
   * @param tag
   * the kind of this handle. Must be {@link Opcodes#H_GETFIELD},
   * {@link Opcodes#H_GETSTATIC}, {@link Opcodes#H_PUTFIELD},
   * {@link Opcodes#H_PUTSTATIC}, {@link Opcodes#H_INVOKEVIRTUAL},
   * {@link Opcodes#H_INVOKESTATIC},
   * {@link Opcodes#H_INVOKESPECIAL},
   * {@link Opcodes#H_NEWINVOKESPECIAL} or
   * {@link Opcodes#H_INVOKEINTERFACE}.
   * @param owner
   * the internal name of the field or method owner class.
   * @param name
   * the name of the field or method.
   * @param desc
   * the descriptor of the field or method.
   * @return the index of a new or already existing method type reference
   * item.
   *
   * @deprecated this method is superseded by
   * {@link #newHandle(int, String, String, String, boolean)}.
   */
  public newHandle$int$java_lang_String$java_lang_String$java_lang_String(
    tag: number,
    owner: string,
    name: string,
    desc: string,
  ): number {
    return this.newHandle(tag, owner, name, desc, tag === Opcodes.H_INVOKEINTERFACE)
  }

  /**
   * Adds a handle to the constant pool of the class being build. Does nothing
   * if the constant pool already contains a similar item. <i>This method is
   * intended for {@link Attribute} sub classes, and is normally not needed by
   * class generators or adapters.</i>
   *
   * @param tag
   * the kind of this handle. Must be {@link Opcodes#H_GETFIELD},
   * {@link Opcodes#H_GETSTATIC}, {@link Opcodes#H_PUTFIELD},
   * {@link Opcodes#H_PUTSTATIC}, {@link Opcodes#H_INVOKEVIRTUAL},
   * {@link Opcodes#H_INVOKESTATIC},
   * {@link Opcodes#H_INVOKESPECIAL},
   * {@link Opcodes#H_NEWINVOKESPECIAL} or
   * {@link Opcodes#H_INVOKEINTERFACE}.
   * @param owner
   * the internal name of the field or method owner class.
   * @param name
   * the name of the field or method.
   * @param desc
   * the descriptor of the field or method.
   * @param itf
   * true if the owner is an interface.
   * @return the index of a new or already existing method type reference
   * item.
   */
  public newHandle(tag?: any, owner?: any, name?: any, desc?: any, itf?: any): any {
    if (
      (typeof tag === 'number' || tag === null) &&
      (typeof owner === 'string' || owner === null) &&
      (typeof name === 'string' || name === null) &&
      (typeof desc === 'string' || desc === null) &&
      (typeof itf === 'boolean' || itf === null)
    ) {
      const __args = Array.prototype.slice.call(arguments)
      return <any>(() => {
        return this.newHandleItem(tag, owner, name, desc, itf).index
      })()
    } else if (
      (typeof tag === 'number' || tag === null) &&
      (typeof owner === 'string' || owner === null) &&
      (typeof name === 'string' || name === null) &&
      (typeof desc === 'string' || desc === null) &&
      itf === undefined
    ) {
      return <any>(
        this.newHandle$int$java_lang_String$java_lang_String$java_lang_String(
          tag,
          owner,
          name,
          desc,
        )
      )
    } else {
      throw new Error('invalid overload')
    }
  }

  /**
   * Adds an invokedynamic reference to the constant pool of the class being
   * build. Does nothing if the constant pool already contains a similar item.
   * <i>This method is intended for {@link Attribute} sub classes, and is
   * normally not needed by class generators or adapters.</i>
   *
   * @param name
   * name of the invoked method.
   * @param desc
   * descriptor of the invoke method.
   * @param bsm
   * the bootstrap method.
   * @param bsmArgs
   * the bootstrap method constant arguments.
   *
   * @return a new or an already existing invokedynamic type reference item.
   */
  newInvokeDynamicItem(name: string, desc: string, bsm: Handle, ...bsmArgs: any[]): Item {
    let bootstrapMethods: ByteVector = this.bootstrapMethods
    if (bootstrapMethods == null) {
      bootstrapMethods = this.bootstrapMethods = new ByteVector()
    }
    const position: number = bootstrapMethods.length
    let hashCode: number = bsm.hashCode()
    bootstrapMethods.putShort(
      this.newHandle(bsm.tag, bsm.owner, bsm.name, bsm.descriptor, bsm.isInterface),
    )
    const argsLength: number = bsmArgs.length
    bootstrapMethods.putShort(argsLength)
    for (let i = 0; i < argsLength; i++) {
      const bsmArg: any = bsmArgs[i]
      hashCode ^= bsmArg.toString()
      bootstrapMethods.putShort(this.newConst(bsmArg))
    }
    const data: Uint8Array = bootstrapMethods.data
    const length: number = (1 + 1 + argsLength) << 1
    hashCode &= 2147483647
    let result: Item = this.items[hashCode % this.items.length]
    loop: while (result != null) {
      if (result.type !== ClassWriterConstant.BSM || result.__hashCode !== hashCode) {
        result = result.next
        continue
      }
      const resultPosition: number = result.intVal
      for (let p = 0; p < length; p++) {
        if (data[position + p] !== data[resultPosition + p]) {
          result = result.next
          continue loop
        }
      }
      break
    }
    let bootstrapMethodIndex: number
    if (result != null) {
      bootstrapMethodIndex = result.index
      bootstrapMethods.length = position
    } else {
      bootstrapMethodIndex = this.bootstrapMethodsCount++
      result = new Item(bootstrapMethodIndex)
      result.setPosHash(position, hashCode)
      this.put(result)
    }
    this.key3.setInvkDynItem(name, desc, bootstrapMethodIndex)
    result = this.get(this.key3)
    if (result == null) {
      this.put122(ClassWriterConstant.INDY, bootstrapMethodIndex, this.newNameType(name, desc))
      result = new Item(this.index++, this.key3)
      this.put(result)
    }
    return result
  }

  /**
   * Adds an invokedynamic reference to the constant pool of the class being
   * build. Does nothing if the constant pool already contains a similar item.
   * <i>This method is intended for {@link Attribute} sub classes, and is
   * normally not needed by class generators or adapters.</i>
   *
   * @param name
   * name of the invoked method.
   * @param desc
   * descriptor of the invoke method.
   * @param bsm
   * the bootstrap method.
   * @param bsmArgs
   * the bootstrap method constant arguments.
   *
   * @return the index of a new or already existing invokedynamic reference
   * item.
   */
  public newInvokeDynamic(name: string, desc: string, bsm: Handle, ...bsmArgs: any[]): number {
    return this.newInvokeDynamicItem.apply(this, [name, desc, bsm].concat(bsmArgs)).index
  }

  /**
   * Adds a field reference to the constant pool of the class being build.
   * Does nothing if the constant pool already contains a similar item.
   *
   * @param owner
   * the internal name of the field's owner class.
   * @param name
   * the field's name.
   * @param desc
   * the field's descriptor.
   * @return a new or already existing field reference item.
   */
  newFieldItem(owner: string, name: string, desc: string): Item {
    this.key3.set(ClassWriterConstant.FIELD, owner, name, desc)
    let result: Item = this.get(this.key3)
    if (result == null) {
      this.put122(ClassWriterConstant.FIELD, this.newClass(owner), this.newNameType(name, desc))
      result = new Item(this.index++, this.key3)
      this.put(result)
    }
    return result
  }

  /**
   * Adds a field reference to the constant pool of the class being build.
   * Does nothing if the constant pool already contains a similar item.
   * <i>This method is intended for {@link Attribute} sub classes, and is
   * normally not needed by class generators or adapters.</i>
   *
   * @param owner
   * the internal name of the field's owner class.
   * @param name
   * the field's name.
   * @param desc
   * the field's descriptor.
   * @return the index of a new or already existing field reference item.
   */
  public newField(owner: string, name: string, desc: string): number {
    return this.newFieldItem(owner, name, desc).index
  }

  /**
   * Adds a method reference to the constant pool of the class being build.
   * Does nothing if the constant pool already contains a similar item.
   *
   * @param owner
   * the internal name of the method's owner class.
   * @param name
   * the method's name.
   * @param desc
   * the method's descriptor.
   * @param itf
   * <tt>true</tt> if <tt>owner</tt> is an interface.
   * @return a new or already existing method reference item.
   */
  newMethodItem(owner: string, name: string, desc: string, itf: boolean): Item {
    const type: number = itf ? ClassWriterConstant.IMETH : ClassWriterConstant.METH
    this.key3.set(type, owner, name, desc)
    let result: Item = this.get(this.key3)
    if (result == null) {
      this.put122(type, this.newClass(owner), this.newNameType(name, desc))
      result = new Item(this.index++, this.key3)
      this.put(result)
    }
    return result
  }

  /**
   * Adds a method reference to the constant pool of the class being build.
   * Does nothing if the constant pool already contains a similar item.
   * <i>This method is intended for {@link Attribute} sub classes, and is
   * normally not needed by class generators or adapters.</i>
   *
   * @param owner
   * the internal name of the method's owner class.
   * @param name
   * the method's name.
   * @param desc
   * the method's descriptor.
   * @param itf
   * <tt>true</tt> if <tt>owner</tt> is an interface.
   * @return the index of a new or already existing method reference item.
   */
  public newMethod(owner: string, name: string, desc: string, itf: boolean): number {
    return this.newMethodItem(owner, name, desc, itf).index
  }

  /**
   * Adds an integer to the constant pool of the class being build. Does
   * nothing if the constant pool already contains a similar item.
   *
   * @param value
   * the int value.
   * @return a new or already existing int item.
   */
  newInteger(value: number): Item {
    this.key.set$int(value)
    let result: Item = this.get(this.key)
    if (result == null) {
      this.pool.putByte(ClassWriterConstant.INT).putInt(value)
      result = new Item(this.index++, this.key)
      this.put(result)
    }
    return result
  }

  /**
   * Adds a float to the constant pool of the class being build. Does nothing
   * if the constant pool already contains a similar item.
   *
   * @param value
   * the float value.
   * @return a new or already existing float item.
   */
  newFloat(value: number): Item {
    this.key.set$float(value)
    let result: Item = this.get(this.key)
    if (result == null) {
      this.pool.putByte(ClassWriterConstant.FLOAT).putInt(this.key.intVal)
      result = new Item(this.index++, this.key)
      this.put(result)
    }
    return result
  }

  /**
   * Adds a long to the constant pool of the class being build. Does nothing
   * if the constant pool already contains a similar item.
   *
   * @param value
   * the long value.
   * @return a new or already existing long item.
   */
  newLong(value: bigint): Item {
    this.key.set$long(value)
    let result: Item = this.get(this.key)
    if (result == null) {
      this.pool.putByte(ClassWriterConstant.LONG).putLong(value)
      result = new Item(this.index, this.key)
      this.index += 2
      this.put(result)
    }
    return result
  }

  /**
   * Adds a double to the constant pool of the class being build. Does nothing
   * if the constant pool already contains a similar item.
   *
   * @param value
   * the double value.
   * @return a new or already existing double item.
   */
  newDouble(value: number): Item {
    this.key.set$double(value)
    let result: Item = this.get(this.key)
    if (result == null) {
      this.pool.putByte(ClassWriterConstant.DOUBLE).putLong(this.key.longVal)
      result = new Item(this.index, this.key)
      this.index += 2
      this.put(result)
    }
    return result
  }

  /**
   * Adds a string to the constant pool of the class being build. Does nothing
   * if the constant pool already contains a similar item.
   *
   * @param value
   * the String value.
   * @return a new or already existing string item.
   */
  private newString(value: string): Item {
    this.key2.set(ClassWriterConstant.STR, value, null, null)
    let result: Item = this.get(this.key2)
    if (result == null) {
      this.pool.put12(ClassWriterConstant.STR, this.newUTF8(value))
      result = new Item(this.index++, this.key2)
      this.put(result)
    }
    return result
  }

  /**
   * Adds a name and type to the constant pool of the class being build. Does
   * nothing if the constant pool already contains a similar item. <i>This
   * method is intended for {@link Attribute} sub classes, and is normally not
   * needed by class generators or adapters.</i>
   *
   * @param name
   * a name.
   * @param desc
   * a type descriptor.
   * @return the index of a new or already existing name and type item.
   */
  public newNameType(name: string, desc: string): number {
    return this.newNameTypeItem(name, desc).index
  }

  /**
   * Adds a name and type to the constant pool of the class being build. Does
   * nothing if the constant pool already contains a similar item.
   *
   * @param name
   * a name.
   * @param desc
   * a type descriptor.
   * @return a new or already existing name and type item.
   */
  newNameTypeItem(name: string, desc: string): Item {
    this.key2.set(ClassWriterConstant.NAME_TYPE, name, desc, null)
    let result: Item = this.get(this.key2)
    if (result == null) {
      this.put122(ClassWriterConstant.NAME_TYPE, this.newUTF8(name), this.newUTF8(desc))
      result = new Item(this.index++, this.key2)
      this.put(result)
    }
    return result
  }

  /**
   * Adds the given internal name to {@link #typeTable} and returns its index.
   * Does nothing if the type table already contains this internal name.
   *
   * @param type
   * the internal name to be added to the type table.
   * @return the index of this internal name in the type table.
   */
  public addType(type?: any): any {
    if (typeof type === 'string' || type === null) {
      const __args = Array.prototype.slice.call(arguments)
      return <any>(() => {
        this.key.set(ClassWriterConstant.TYPE_NORMAL, type, null, null)
        let result: Item = this.get(this.key)
        if (result == null) {
          result = this.addType(this.key)
        }
        return result.index
      })()
    } else if ((type != null && type instanceof Item) || type === null) {
      return <any>this.addType$Item(type)
    } else {
      throw new Error('invalid overload')
    }
  }

  /**
   * Adds the given "uninitialized" type to {@link #typeTable} and returns its
   * index. This method is used for UNINITIALIZED types, made of an internal
   * name and a bytecode offset.
   *
   * @param type
   * the internal name to be added to the type table.
   * @param offset
   * the bytecode offset of the NEW instruction that created this
   * UNINITIALIZED type value.
   * @return the index of this internal name in the type table.
   */
  addUninitializedType(type: string, offset: number): number {
    this.key.type = ClassWriterConstant.TYPE_UNINIT
    this.key.intVal = offset
    this.key.strVal1 = type
    this.key.__hashCode =
      2147483647 & (ClassWriterConstant.TYPE_UNINIT + <any>type.toString() + offset)
    let result: Item = this.get(this.key)
    if (result == null) {
      result = this.addType(this.key)
    }
    return result.index
  }

  /**
   * Adds the given Item to {@link #typeTable}.
   *
   * @param item
   * the value to be added to the type table.
   * @return the added Item, which a new Item instance with the same value as
   * the given Item.
   */
  private addType$Item(item: Item): Item {
    throw new Error('not supported')
    // ++this.typeCount;
    // let result: Item = new Item(this.typeCount, this.key);
    // this.put(result);
    // if (this.typeTable == null) {
    //     this.typeTable = new Array(16);
    // }
    // if (this.typeCount === this.typeTable.length) {
    //     let newTable: Item[] = new Array(2 * this.typeTable.length);
    //     java.lang.System.arraycopy(this.typeTable, 0, newTable, 0, this.typeTable.length);
    //     this.typeTable = newTable;
    // }
    // this.typeTable[this.typeCount] = result;
    // return result;
  }

  /**
   * Returns the index of the common super type of the two given types. This
   * method calls {@link #getCommonSuperClass} and caches the result in the
   * {@link #items} hash table to speedup future calls with the same
   * parameters.
   *
   * @param type1
   * index of an internal name in {@link #typeTable}.
   * @param type2
   * index of an internal name in {@link #typeTable}.
   * @return the index of the common super type of the two given types.
   */
  getMergedType(type1: number, type2: number): number {
    throw new Error('not supported')
    // this.key2.type = ClassWriterConstant.TYPE_MERGED;
    // this.key2.longVal = type1 | ((Math.round(<number>type2)) << 32);
    // this.key2.__hashCode = 2147483647 & (ClassWriterConstant.TYPE_MERGED + type1 + type2);
    // let result: Item = this.get(this.key2);
    // if (result == null) {
    //     let t: string = this.typeTable[type1].strVal1;
    //     let u: string = this.typeTable[type2].strVal1;
    //     this.key2.intVal = this.addType(this.getCommonSuperClass(t, u));
    //     result = new Item((<number>0 | 0), this.key2);
    //     this.put(result);
    // }
    // return result.intVal;
  }

  /**
   * Returns the common super type of the two given types. The default
   * implementation of this method <i>loads</i> the two given classes and uses
   * the java.lang.Class methods to find the common super class. It can be
   * overridden to compute this common super type in other ways, in particular
   * without actually loading any class, or to take into account the class
   * that is currently being generated by this ClassWriter, which can of
   * course not be loaded since it is under construction.
   *
   * @param type1
   * the internal name of a class.
   * @param type2
   * the internal name of another class.
   * @return the internal name of the common super class of the two given
   * classes.
   */
  getCommonSuperClass(type1: string, type2: string): string {
    return 'java/lang/Object'
    // break....
    // let c: any;
    // let d: any;
    // let classLoader: java.lang.ClassLoader = (<any>this.constructor).getClassLoader();
    // try {
    //     c = java.lang.Class.forName(/* replace */type1.split('/').join('.'), false, classLoader);
    //     d = java.lang.Class.forName(/* replace */type2.split('/').join('.'), false, classLoader);
    // } catch (e) {
    //     throw new Error(e.toString());
    // };
    // if (c.isAssignableFrom(d)) {
    //     return type1;
    // }
    // if (d.isAssignableFrom(c)) {
    //     return type2;
    // }
    // if (c.isInterface() || d.isInterface()) {
    //     return "java/lang/Object";
    // } else {
    //     do {
    //         c = c.getSuperclass();
    //     } while ((!c.isAssignableFrom(d)));
    //     return /* replace *//* getName */(c => c["__class"] ? c["__class"] : c.name)(c).split('.').join('/');
    // }
  }

  /**
   * Returns the constant pool's hash table item which is equal to the given
   * item.
   *
   * @param key
   * a constant pool item.
   * @return the constant pool's hash table item which is equal to the given
   * item, or <tt>null</tt> if there is no such item.
   */
  private get(key: Item): Item {
    let i: Item = this.items[key.__hashCode % this.items.length]
    while (i != null && (i.type !== key.type || !key.isEqualTo(i))) {
      i = i.next
    }
    return i
  }

  /**
   * Puts the given item in the constant pool's hash table. The hash table
   * <i>must</i> not already contains this item.
   *
   * @param i
   * the item to be added to the constant pool's hash table.
   */
  private put(i: Item) {
    if (this.index + this.typeCount > this.threshold) {
      const ll: number = this.items.length
      const nl: number = ll * 2 + 1
      const newItems: Item[] = new Array(nl)
      for (let l: number = ll - 1; l >= 0; --l) {
        let j: Item = this.items[l]
        while (j != null) {
          const index: number = j.__hashCode % newItems.length
          const k: Item = j.next
          j.next = newItems[index]
          newItems[index] = j
          j = k
        }
      }
      this.items = newItems
      this.threshold = (nl * 0.75) | 0
    }
    const index: number = i.__hashCode % this.items.length
    i.next = this.items[index]
    this.items[index] = i
  }

  /**
   * Puts one byte and two shorts into the constant pool.
   *
   * @param b
   * a byte.
   * @param s1
   * a short.
   * @param s2
   * another short.
   */
  private put122(b: number, s1: number, s2: number) {
    this.pool.put12(b, s1).putShort(s2)
  }

  /**
   * Puts two bytes and one short into the constant pool.
   *
   * @param b1
   * a byte.
   * @param b2
   * another byte.
   * @param s
   * a short.
   */
  private put112(b1: number, b2: number, s: number) {
    this.pool.put11(b1, b2).putShort(s)
  }
}

ClassWriterConstant.__static_initialize()
