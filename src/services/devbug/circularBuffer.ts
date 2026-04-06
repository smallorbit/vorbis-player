export class CircularBuffer<T> {
  private readonly capacity: number;
  private readonly buffer: (T | undefined)[];
  private head = 0;
  private size = 0;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    const index = (this.head + this.size) % this.capacity;
    this.buffer[index] = item;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const item = this.buffer[(this.head + i) % this.capacity];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
    this.buffer.fill(undefined);
  }

  get length(): number {
    return this.size;
  }
}
