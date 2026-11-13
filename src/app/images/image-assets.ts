import { Injectable, OnDestroy, signal } from '@angular/core';
import { LayoutNode } from '../layout/layout.model';
import { ImageReference, isStoredImage } from './image-reference';
import { photoMonth, readPhotoMonth } from './photo-date';

export interface GalleryImage {
  name: string;
  data: string;
  thumbnail: string;
}
interface StoredImage {
  id: string;
  name: string;
  blob: Blob;
  thumbnail?: Blob;
  signature?: string;
  date?: string;
}
interface LoadedImage {
  record: StoredImage;
  url: string;
  thumbnailUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ImageAssets implements OnDestroy {
  readonly gallery = signal<GalleryImage[]>([]);
  readonly missing = signal<ImageReference[]>([]);
  private manifest: ImageReference[] = [];
  private loaded = new Map<string, LoadedImage>();
  private revision = signal(0);
  private database?: Promise<IDBDatabase>;
  private destroyed = false;
  private generation = 0;
  get version(): number {
    return this.generation;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        const request = indexedDB.open('photo-armaurie-images', 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('images', { keyPath: 'id' });
        request.onsuccess = () => {
          const db = request.result;
          if (this.destroyed) db.close();
          db.onversionchange = () => {
            db.close();
            this.database = undefined;
          };
          resolve(db);
        };
        request.onerror = () =>
          reject(
            new Error(
              'Photo storage is unavailable. Check browser storage permissions or free some space.',
            ),
          );
        request.onblocked = () =>
          reject(
            new Error(
              'Photo storage is blocked by another open tab. Close other collage tabs and try again.',
            ),
          );
      });
      void this.database.catch(() => {
        this.database = undefined;
      });
    }
    return this.database;
  }

  private async read(id: string): Promise<StoredImage | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('images', 'readonly');
      const request = transaction.objectStore('images').get(id);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () =>
        reject(new Error('Could not read stored photos.'));
    });
  }

  private async write(record: StoredImage, version = this.generation): Promise<void> {
    const db = await this.open();
    if (version !== this.generation) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.objectStore('images').put(record);
      // Do not expose a reference until its original has committed successfully.
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () =>
        reject(
          new Error('Could not store this photo. Browser storage may be full or disabled.'),
        );
    });
  }

  private cache(record: StoredImage): LoadedImage {
    const previous = this.loaded.get(record.id);
    if (previous) return previous;
    const url = URL.createObjectURL(record.blob);
    const loaded = {
      record,
      url,
      thumbnailUrl: record.thumbnail ? URL.createObjectURL(record.thumbnail) : url,
    };
    this.loaded.set(record.id, loaded);
    this.revision.update((value) => value + 1);
    return loaded;
  }

  urlFor(src: string): string {
    this.revision();
    return isStoredImage(src) ? (this.loaded.get(src)?.url ?? '') : src;
  }

  references(): ImageReference[] {
    return this.manifest.map((reference) => ({ ...reference }));
  }

  dateFor(src: string, name?: string): string | undefined {
    return (
      this.loaded.get(src)?.record.date ??
      this.manifest.find((entry) => entry.src === src)?.date ??
      photoMonth(name) ??
      (isStoredImage(src) ? undefined : photoMonth(src))
    );
  }

  hasFile(file: File): boolean {
    if (this.missing().some((reference) => reference.name === file.name)) return false;
    const signature = JSON.stringify([file.name, file.size, file.lastModified]);
    return this.manifest.some(
      (reference) => this.loaded.get(reference.src)?.record.signature === signature,
    );
  }

  async add(
    file: Blob,
    thumbnail?: Blob,
    name = file instanceof File ? file.name : 'Photo',
  ): Promise<string> {
    const version = this.generation;
    const signature =
      file instanceof File
        ? JSON.stringify([file.name, file.size, file.lastModified])
        : undefined;
    const duplicate =
      signature &&
      this.manifest.find(
        (reference) => this.loaded.get(reference.src)?.record.signature === signature,
      );
    const missing = this.missing().filter((reference) => reference.name === name);
    if (duplicate && missing.length !== 1) return duplicate.src;
    const id = missing.length === 1 ? missing[0].src : `asset:${crypto.randomUUID()}`;
    const date = await readPhotoMonth(file, name);
    const record: StoredImage = {
      id,
      name,
      blob: file,
      thumbnail,
      signature,
      ...(date ? { date } : {}),
    };
    await this.write(record, version);
    if (this.destroyed || version !== this.generation) return '';
    const loaded = this.cache(record);
    if (!this.manifest.some((reference) => reference.src === id))
      this.manifest.push({ src: id, name, ...(date ? { date } : {}) });
    else if (date)
      this.manifest = this.manifest.map((entry) =>
        entry.src === id ? { ...entry, date } : entry,
      );
    this.gallery.update((images) => [
      ...images.filter((image) => image.data !== id),
      { name, data: id, thumbnail: loaded.thumbnailUrl },
    ]);
    this.missing.update((images) => images.filter((image) => image.src !== id));
    return id;
  }

  /** Resolve stable references, migrating legacy embedded images once on import. */
  async prepareProject(
    root: LayoutNode | readonly LayoutNode[],
    references: ImageReference[],
  ): Promise<boolean> {
    const version = ++this.generation;
    const referenceDates = new Map(
      references.map((reference) => [reference.src, reference.date]),
    );
    const manifest = new Map(references.map((reference) => [reference.src, reference.name]));
    const placements: { src: string; name?: string }[] = [];
    const visit = (node: LayoutNode): void => {
      if (node.image) {
        placements.push(node.image);
        manifest.set(
          node.image.src,
          node.image.name || manifest.get(node.image.src) || 'Photo',
        );
      }
      if (node.first) visit(node.first);
      if (node.second) visit(node.second);
    };
    if (Array.isArray(root)) root.forEach(visit);
    else visit(root as LayoutNode);
    const images: GalleryImage[] = [];
    const missing: ImageReference[] = [];
    const nextManifest: ImageReference[] = [];
    for (const [original, name] of manifest) {
      let src = original;
      if (src.startsWith('data:')) {
        const blob = await (await fetch(src)).blob();
        let thumbnail: Blob | undefined;
        try {
          thumbnail = await createThumbnail(blob);
        } catch {
          /* Preserve legacy originals even without a preview decoder. */
        }
        src = `asset:${crypto.randomUUID()}`;
        const record = { id: src, name, blob, thumbnail };
        await this.write(record, version);
        if (version !== this.generation) return false;
        this.cache(record);
        for (const image of placements) if (image.src === original) image.src = src;
      }
      const date = referenceDates.get(original);
      const reference: ImageReference = {
        src,
        name,
        ...(date ? { date } : {}),
      };
      nextManifest.push(reference);
      if (isStoredImage(src)) {
        const record = this.loaded.get(src)?.record ?? (await this.read(src));
        if (version !== this.generation) return false;
        if (!record) {
          missing.push(reference);
          continue;
        }
        if (!record.date) {
          record.date = reference.date ?? (await readPhotoMonth(record.blob, name));
          if (version !== this.generation) return false;
        }
        if (record.date) reference.date = record.date;
        const loaded = this.cache(record);
        images.push({ name, data: src, thumbnail: loaded.thumbnailUrl });
      } else {
        images.push({ name, data: src, thumbnail: src });
      }
    }
    if (version !== this.generation) return false;
    this.manifest = nextManifest;
    this.gallery.set(images);
    this.missing.set(missing);
    return true;
  }

  async clear(): Promise<void> {
    ++this.generation;
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.objectStore('images').clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () =>
        reject(new Error('Could not delete stored photos. Please try again.'));
    });
    this.releaseUrls();
    this.manifest = [];
    this.gallery.set([]);
    this.missing.set([]);
    this.revision.update((value) => value + 1);
  }

  private releaseUrls(): void {
    for (const loaded of this.loaded.values()) {
      URL.revokeObjectURL(loaded.url);
      if (loaded.thumbnailUrl !== loaded.url) URL.revokeObjectURL(loaded.thumbnailUrl);
    }
    this.loaded.clear();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.releaseUrls();
    void this.database?.then(
      (db) => db.close(),
      () => {},
    );
  }
}

export async function createThumbnail(file: Blob): Promise<Blob> {
  // Keep decoding sequential in the library so large photo batches do not
  // simultaneously allocate a full-sized bitmap for every original.
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create an image preview.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error('Could not create an image preview.')),
        'image/png',
      );
    });
  } finally {
    bitmap.close();
  }
}
