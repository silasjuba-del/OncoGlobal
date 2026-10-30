export function createSaveTracker<T>(save: (value: T) => Promise<void>) {
  let serial = 0, snapshot: { pending: number; error: string | null } = { pending: 0, error: null };
  const listeners = new Set<() => void>();
  const update = (next: typeof snapshot) => { snapshot = next; listeners.forEach(fn => fn()); };
  return {
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async write(value: T) {
      const id = ++serial;
      update({ ...snapshot, pending: snapshot.pending + 1 });
      try { await save(value); if (id === serial) update({ ...snapshot, error: null }); }
      catch (error) { if (id === serial) update({ ...snapshot, error: error instanceof Error ? error.message : 'Falha ao salvar biblioteca.' }); throw error; }
      finally { update({ ...snapshot, pending: snapshot.pending - 1 }); }
    },
  };
}
