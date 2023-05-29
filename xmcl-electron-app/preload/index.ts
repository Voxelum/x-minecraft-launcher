import './controller'
import './semaphore'
import './service'
import './task'
import './bootstrap'

if (process.env.NODE_ENV === 'development') {
  console.log(`Process id=${process.pid}`)
}
