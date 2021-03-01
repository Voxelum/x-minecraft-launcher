// import 'reflect-metadata'
// import { writeFile } from 'atomically'

// class A {

// }

// function logParamTypes(target: any) {
//   // const types = Reflect.getMetadata('design:paramtypes', target)
//   // console.log('param types')
//   // console.log(types)
// }
// class C { }

// @logParamTypes
// class B extends C {
//   constructor(private x: A, private z: FF) { super() }
// }

// interface FF {

// }

// console.log(Reflect.getMetadata('design:paramtypes', B))
// console.log(Reflect.getMetadata('design:paramtypes', B))
// const b = new B(new A(), {})

// console.log(Object.getPrototypeOf(b).constructor)
// console.log(Object.getPrototypeOf(b).constructor.name)

// console.log(Object.getPrototypeOf(Object.getPrototypeOf(b)).constructor)
// console.log(Object.getPrototypeOf(B))
import { watchFile, writeFile } from 'fs-extra'
import watch from 'node-watch'

// const watcher = watchFile('./abc.txt', (cur, prev) => {
//   console.log(`File changed ${prev.size} -> ${cur.size}`)
// })

// watch('./abc.txt', (event, f) => {
//   console.log(`File changed ${event} ${f}`)
// })

async function x() {
  console.log('content write 1 start')
  await writeFile('./abc.txt', 'content1!')
  console.log('content write 1 end')
  await new Promise<void>((resolve) => { setTimeout(resolve, 1000) })
  console.log('content write 2 start')
  await writeFile('./abc.txt', 'content2!')
  console.log('content write 2 end')
  await new Promise<void>((resolve) => { setTimeout(resolve, 1000) })
  console.log('content write 3 start')
  await writeFile('./abc.txt', 'content3!')
  console.log('content write 3 end')
}

// x()

writeFile('./abc.txt', 'content1!')
writeFile('./abc.txt', 'content2!')
writeFile('./abc.txt', 'content3!')
writeFile('./abc.txt', 'content4!')
