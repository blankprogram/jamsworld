export default class FBOPool {
  constructor(gl) {
    this.gl = gl;
    this.pool = new Map();
    this.pairPool = new Map();
    this._allocatedBytes = 0;
  }

  _addVRAM(w, h) {
    this._allocatedBytes += w * h * 4;
  }

  _subVRAM(w, h) {
    this._allocatedBytes -= w * h * 4;
    if (this._allocatedBytes < 0) this._allocatedBytes = 0;
  }

  getTemp(w, h, exclude = new Set()) {
    const key = `${w}x${h}`;
    if (!this.pool.has(key)) this.pool.set(key, []);
    const poolArr = this.pool.get(key);
    for (let i = 0; i < poolArr.length; ++i) {
      if (!exclude.has(poolArr[i].tex)) {
        return poolArr.splice(i, 1)[0];
      }
    }
    return this.allocate(w, h);
  }

  getPair(w, h) {
    const key = `${w}x${h}`;
    if (!this.pairPool.has(key)) {
      const make = () => this.allocate(w, h);
      let ping = 0;
      this.pairPool.set(key, {
        fbos: [make(), make()],
        next: function () {
          ping = 1 - ping;
          return this.fbos[ping];
        },
      });
    }
    return this.pairPool.get(key);
  }

  returnTemp(temp) {
    const key = `${temp.w}x${temp.h}`;
    if (!this.pool.has(key)) this.pool.set(key, []);
    this.pool.get(key).push(temp);
  }

  pruneAll() {
    for (const poolArr of this.pool.values()) {
      for (const { fbo, tex, w, h } of poolArr) {
        this.gl.deleteFramebuffer(fbo);
        this.gl.deleteTexture(tex);
        this._subVRAM(w, h);
      }
    }
    this.pool.clear();
  }

  allocate(w, h) {
    const tex = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      w,
      h,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR,
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR,
    );

    const fbo = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      tex,
      0,
    );
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    this._addVRAM(w, h);
    return { fbo, tex, w, h };
  }

  destroy() {
    for (const arr of this.pool.values()) {
      for (const { fbo, tex, w, h } of arr) {
        this.gl.deleteFramebuffer(fbo);
        this.gl.deleteTexture(tex);
        this._subVRAM(w, h);
      }
    }
    for (const pair of this.pairPool.values()) {
      for (const { fbo, tex, w, h } of pair.fbos) {
        this.gl.deleteFramebuffer(fbo);
        this.gl.deleteTexture(tex);
        this._subVRAM(w, h);
      }
    }
    this.pool.clear();
    this.pairPool.clear();
  }
}
