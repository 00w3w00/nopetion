/** Keep title writes in order; one failed write must not poison later saves. */
export function createSerialSave<T, R>(save: (value: T) => Promise<R>): (value: T) => Promise<R> {
  let tail: Promise<void> = Promise.resolve();
  return (value) => {
    const result = tail.then(() => save(value));
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}
