import { promisify } from 'util'
import { Channel, CloseEvent, ErrorEvent, ValueEvent } from './channel'

describe(`channel`, () => {
  test(`normal subscription`, async () => {
    const chan = new Channel<number>()
    setTimeout(async () => {
      for (let i = 0; i < 3; i++) await chan.send(i)
      await chan.close()
    }, 200)
    const results: number[] = []
    for await (const i of chan) results.push(i)
    expect(results).toEqual([0, 1, 2])
  }, 1000)
  test(`parallel subscriptions`, async () => {
    const chan = new Channel<number>()
    setTimeout(async () => {
      for (let i = 0; i < 3; i++) {
        await chan.send(i)
        await promisify(setTimeout)(100)
      }
      chan.close()
    }, 100)
    const result1: number[] = []
    const result2: number[] = []
    await Promise.all(
      [result1, result2].map(async result => {
        for await (const i of chan) result.push(i)
      })
    )
    expect(result1).toEqual([0, 1, 2])
    expect(result2).toEqual([0, 1, 2])
  }, 2000)
  test(`empty channel`, async () => {
    const chan = new Channel<number>()
    await chan.close()
    await expect(chan.send(1)).rejects.toBeTruthy()
    let iterations = 0
    for await (const _ of chan) iterations++
    expect(iterations).toEqual(0)
  }, 1000)
  test(`clean up`, async () => {
    class MockChannel<T> extends Channel<T> {
      get em() {
        return this._em
      }
    }
    const chan = new MockChannel<number>()
    setTimeout(async () => {
      for (let i = 0; i < 3; ++i) {
        await chan.send(i)
        await promisify(setTimeout)(100)
      }
      chan.close()
    }, 100)
    let tested = false
    for await (const _ of chan) {
      tested = true
      expect(chan.em.listenerCount(ValueEvent)).toBeGreaterThan(0)
      expect(chan.em.listenerCount(ErrorEvent)).toBeGreaterThan(0)
      expect(chan.em.listenerCount(CloseEvent)).toBeGreaterThan(0)
      break
    }
    expect(chan.em.listenerCount(ValueEvent)).toEqual(0)
    expect(chan.em.listenerCount(ErrorEvent)).toEqual(0)
    expect(chan.em.listenerCount(CloseEvent)).toEqual(0)
    expect(tested).toBeTruthy()
  })
})
