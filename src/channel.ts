import EventEmitter from 'events'

import { Closer } from './closer'
import { Sender } from './sender'

export const ValueEvent = Symbol(`value`)
export const ErrorEvent = Symbol(`error`)
export const CloseEvent = Symbol(`close`)
const CloseError = new Error(`channel closed`)

export class Channel<T> implements Sender<T>, Closer, AsyncIterable<T> {
  protected _em = new InnerEventEmitter<T>()
  private done = false

  async send(val: T) {
    if (this.done) throw CloseError
    this._em.emit(ValueEvent, val)
  }
  async close() {
    if (this.done) throw CloseError
    this.done = true
    this._em.emit(CloseEvent)
  }
  [Symbol.asyncIterator]() {
    const buffer: T[] = []
    let resolve: () => void = () => {}
    let reject: (e: unknown) => void = () => {}
    let promise = new Promise<void>((r, j) => {
      resolve = r
      reject = j
    })
    const valueHandler = (val: T) => {
      buffer.push(val)
      resolve()
      promise = new Promise<void>((r, j) => {
        resolve = r
        reject = j
      })
    }
    const errorHandler = (e: unknown) => {
      reject(e)
    }
    const closeHandler = () => {
      resolve()
    }
    this._em.on(ValueEvent, valueHandler)
    this._em.on(ErrorEvent, errorHandler)
    this._em.on(CloseEvent, closeHandler)
    const cleanup = () => {
      this._em.removeListener(ValueEvent, valueHandler)
      this._em.removeListener(ErrorEvent, errorHandler)
      this._em.removeListener(CloseEvent, closeHandler)
    }
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
      return: async () => {
        cleanup()
        return { done: true }
      },
      throw: async () => {
        cleanup()
        return { done: true }
      },
    } as AsyncIterator<T>
  }
}

class InnerEventEmitter<T> extends EventEmitter {
  on(ev: typeof ValueEvent, cb: (payload: T) => void): this
  on(ev: typeof ErrorEvent, cb: (e: unknown) => void): this
  on(ev: typeof CloseEvent, cb: () => void): this
  on(ev: string | symbol, cb: (payload: any) => void) {
    return super.on(ev, cb)
  }
  emit(ev: typeof ValueEvent, payload: T): boolean
  emit(ev: typeof ErrorEvent, e: unknown): boolean
  emit(ev: typeof CloseEvent): boolean
  emit(ev: string | symbol, payload?: any) {
    return super.emit(ev, payload)
  }
}
