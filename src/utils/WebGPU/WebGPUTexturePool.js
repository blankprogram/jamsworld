import { GPU_TEXTURE_USAGE } from "./constants";

export default class WebGPUTexturePool {
  constructor(device, format) {
    this.device = device;
    this.format = format;
    this.pool = new Map();
    this.nextId = 1;
  }

  getTemp(width, height, exclude = []) {
    const key = `${width}x${height}`;
    const bucket = this.pool.get(key);
    const excluded = new Set(Array.isArray(exclude) ? exclude : [exclude]);
    if (bucket?.length) {
      const skipped = [];
      while (bucket.length) {
        const texture = bucket.pop();
        if (!excluded.has(texture)) {
          for (const skippedTexture of skipped) bucket.push(skippedTexture);
          return texture;
        }
        skipped.push(texture);
      }
      for (const skippedTexture of skipped) bucket.push(skippedTexture);
    }

    return this.device.createTexture({
      label: `WebGPUTexturePool ${key} #${this.nextId++}`,
      size: { width, height },
      format: this.format,
      usage:
        GPU_TEXTURE_USAGE.TEXTURE_BINDING |
        GPU_TEXTURE_USAGE.STORAGE_BINDING |
        GPU_TEXTURE_USAGE.COPY_SRC |
        GPU_TEXTURE_USAGE.COPY_DST |
        GPU_TEXTURE_USAGE.RENDER_ATTACHMENT,
    });
  }

  returnTemp(texture, width, height) {
    if (!texture || width <= 0 || height <= 0) return;
    const key = `${width}x${height}`;
    if (!this.pool.has(key)) this.pool.set(key, []);
    const bucket = this.pool.get(key);
    if (!bucket.includes(texture)) bucket.push(texture);
  }

  pruneAll() {
    for (const bucket of this.pool.values()) {
      for (const texture of bucket) texture.destroy();
    }
    this.pool.clear();
  }

  destroy() {
    this.pruneAll();
  }
}
