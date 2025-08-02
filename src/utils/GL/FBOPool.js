export default class FBOPool {
  constructor(gl) {
    this.gl = gl;
    this.pool = new Map();
    this.pairPool = new Map();
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
    return { fbo, tex };
  }

  getTemp(w, h, exclude = new Set()) {
    const key = `${w}x${h}`;
    if (!this.pool.has(key)) {
      this.pool.set(key, []);
    }
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
      const make = () => {
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
        return { fbo, tex };
      };
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

  releaseAllExcept(liveTextures) {
    for (const poolArr of this.pool.values()) {
      for (let i = poolArr.length - 1; i >= 0; --i) {
        if (!liveTextures.has(poolArr[i].tex)) {
          const { fbo, tex } = poolArr.splice(i, 1)[0];
          this.gl.deleteFramebuffer(fbo);
          this.gl.deleteTexture(tex);
        }
      }
    }
  }

  destroy() {
    for (let fbos of this.pool.values()) {
      for (let { fbo, tex } of fbos) {
        this.gl.deleteFramebuffer(fbo);
        this.gl.deleteTexture(tex);
      }
    }
    for (let pair of this.pairPool.values()) {
      for (let { fbo, tex } of pair.fbos) {
        this.gl.deleteFramebuffer(fbo);
        this.gl.deleteTexture(tex);
      }
    }
    this.pool.clear();
    this.pairPool.clear();
  }
}
