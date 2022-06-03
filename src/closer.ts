export interface Closer {
  close(): Promise<void>
}
