import EventEmitter from 'events'
import { Closer } from './closer'

import { Sender } from './sender'

const ValueEvent = Symbol(`value`)
const CloseError = new Error(`channel closed`)

export class Channel<T> implements Sender<T>, Closer, AsyncIterable<T> {
  private em = new InnerEventEmitter<T>()
  private done = false

  async send(val: T) {
    if (this.done) throw CloseError
    this.em.emit(ValueEvent, val)
  }
  async close() {
    if (this.done) throw CloseError
    this.done = true
    this.em.emit(`close`)
  }
  [Symbol.asyncIterator]() {
    const buffer: T[] = []
    let resolve: () => void = () => {}
    let reject: (e: unknown) => void = () => {}
    let promise = new Promise<void>((r, j) => {
      resolve = r
      reject = j
    })
    this.em.on(ValueEvent, val => {
      buffer.push(val)
      resolve()
      promise = new Promise<void>((r, j) => {
        resolve = r
        reject = j
      })
    })
    this.em.on(`error`, (e: unknown) => {
      reject(e)
    })
    this.em.on(`close`, () => {
      resolve()
    })
    return {
      next: async () => {
        if (this.done) return { done: true }
        else if (buffer.length) return { value: buffer.shift() }
        else {
          await promise
          if (this.done) return { done: true }
          else return { value: buffer.shift() }
        }
      },
    } as AsyncIterator<T>
  }
}

class InnerEventEmitter<T> extends EventEmitter {
  on(ev: typeof ValueEvent, cb: (payload: T) => void): this
  on(ev: `error`, cb: (e: unknown) => void): this
  on(ev: `close`, cb: () => void): this
  on(ev: string | symbol, cb: (payload: any) => void) {
    return super.on(ev, cb)
  }
  emit(ev: typeof ValueEvent, payload: T): boolean
  emit(ev: `error`, e: unknown): boolean
  emit(ev: `close`): boolean
  emit(ev: string | symbol, payload?: any) {
    return super.emit(ev, payload)
  }
}
