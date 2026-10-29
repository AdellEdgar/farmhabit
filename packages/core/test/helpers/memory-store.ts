import type { RemoteFile, RemoteStore } from '../../src/sync/vault';

/** Almacenamiento remoto en memoria, compartido por varios "dispositivos". */
export class MemoryStore implements RemoteStore {
  readonly files = new Map<string, { data: Uint8Array; modifiedAt: number }>();
  reads: string[] = [];
  writes: string[] = [];
  private tick = 0;

  async list(): Promise<RemoteFile[]> {
    return [...this.files.entries()].map(([name, f]) => ({ name, modifiedAt: f.modifiedAt }));
  }

  async read(name: string): Promise<Uint8Array | null> {
    this.reads.push(name);
    return this.files.get(name)?.data.slice() ?? null;
  }

  async write(name: string, data: Uint8Array): Promise<void> {
    this.writes.push(name);
    this.files.set(name, { data: data.slice(), modifiedAt: ++this.tick });
  }
}
