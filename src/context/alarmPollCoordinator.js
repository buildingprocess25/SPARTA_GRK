export function createAlarmPollCoordinator() {
  let sequence = 0;
  let current = null;
  let disposed = false;

  return {
    begin() {
      if (disposed) throw new Error('Alarm poll coordinator is disposed');
      current?.controller.abort();
      const request = { id: ++sequence, controller: new AbortController() };
      current = request;
      return { id: request.id, signal: request.controller.signal };
    },
    isCurrent(id) {
      return !disposed && current?.id === id && !current.controller.signal.aborted;
    },
    dispose() {
      disposed = true;
      current?.controller.abort();
      current = null;
    },
  };
}

