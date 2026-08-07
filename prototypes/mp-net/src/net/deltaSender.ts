// Send-when-idle batching for the inputDelta counter test (see Part 5 of
// BRIEF.md). Presses accumulate locally in `pendingDelta` regardless of
// network state. If no send is in flight, the current pending amount is
// sent immediately and reset to 0; further presses keep accumulating while
// that send is in flight. When it resolves, a pending amount triggers
// another send right away - this naturally batches rapid clicking into
// fewer sends instead of needing a guessed fixed interval.
export function createDeltaSender(send: (delta: number) => Promise<void>): () => void {
  let pendingDelta = 0;
  let sending = false;

  const flush = (): void => {
    if (sending || pendingDelta === 0) return;
    const delta = pendingDelta;
    pendingDelta = 0;
    sending = true;
    void send(delta).finally(() => {
      sending = false;
      flush();
    });
  };

  return () => {
    pendingDelta += 1;
    flush();
  };
}
