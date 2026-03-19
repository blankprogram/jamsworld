const samplerUniformCacheByContext = new WeakMap();

export function createGLStateCache() {
  return {
    framebuffer: undefined,
    viewportX: undefined,
    viewportY: undefined,
    viewportW: undefined,
    viewportH: undefined,
    blendEnabled: undefined,
    program: undefined,
    vao: undefined,
    textureFilterCache: new WeakMap(),
  };
}

export function resetGLStateCache(cache) {
  if (!cache) return;
  cache.framebuffer = undefined;
  cache.viewportX = undefined;
  cache.viewportY = undefined;
  cache.viewportW = undefined;
  cache.viewportH = undefined;
  cache.blendEnabled = undefined;
  cache.program = undefined;
  cache.vao = undefined;
}

export function bindFramebufferCached(gl, framebuffer, cache) {
  if (!cache) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    return;
  }
  if (cache.framebuffer !== framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    cache.framebuffer = framebuffer;
  }
}

export function setViewportCached(gl, x, y, w, h, cache) {
  if (!cache) {
    gl.viewport(x, y, w, h);
    return;
  }
  if (
    cache.viewportX !== x ||
    cache.viewportY !== y ||
    cache.viewportW !== w ||
    cache.viewportH !== h
  ) {
    gl.viewport(x, y, w, h);
    cache.viewportX = x;
    cache.viewportY = y;
    cache.viewportW = w;
    cache.viewportH = h;
  }
}

export function setBlendEnabledCached(gl, enabled, cache) {
  if (!cache) {
    if (enabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    return;
  }
  if (cache.blendEnabled !== enabled) {
    if (enabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    cache.blendEnabled = enabled;
  }
}

export function setProgramCached(gl, program, cache) {
  if (!cache) {
    gl.useProgram(program);
    return;
  }
  if (cache.program !== program) {
    gl.useProgram(program);
    cache.program = program;
  }
}

export function bindVertexArrayCached(gl, vao, cache) {
  if (!cache) {
    gl.bindVertexArray(vao);
    return;
  }
  if (cache.vao !== vao) {
    gl.bindVertexArray(vao);
    cache.vao = vao;
  }
}

export function cacheTextureFilterState(cache, texture, minFilter, magFilter) {
  if (!cache || !cache.textureFilterCache || !texture) return false;
  const rec = cache.textureFilterCache.get(texture) || {};
  const changed = rec.min !== minFilter || rec.mag !== magFilter;
  if (changed) {
    cache.textureFilterCache.set(texture, { min: minFilter, mag: magFilter });
  }
  return changed;
}

export function bindTexture(gl, unit, tex, uniformLocation) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (uniformLocation != null) {
    let cache = samplerUniformCacheByContext.get(gl);
    if (!cache) {
      cache = new WeakMap();
      samplerUniformCacheByContext.set(gl, cache);
    }
    const prev = cache.get(uniformLocation);
    if (prev !== unit) {
      gl.uniform1i(uniformLocation, unit);
      cache.set(uniformLocation, unit);
    }
  }
}

export function hexToRgbArray(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
