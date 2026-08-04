// Tiny pub-sub bus so a mutation anywhere (buy, sell, start an action...) can
// tell components polling *unrelated* endpoints — the navbar's wallet/storage
// chips, the notification bell — to refresh immediately instead of waiting
// for their own timer. `api.ts` emits on every non-GET request; anything that
// wants instant updates subscribes via `useMutationRefresh` (see hooks.ts).
type Listener = () => void;

const listeners = new Set<Listener>();

export function emitMutation() {
  for (const listener of listeners) listener();
}

export function onMutation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
