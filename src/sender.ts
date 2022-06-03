export interface Sender<T> {
  send(val: T): Promise<void>
}
