export const loadFonts = async () => {
  try {
    await document.fonts.ready;
    const fontFaces = Array.from(document.fonts);
    const additionalFonts = [
      "Arial",
      "Courier New",
      "Times New Roman",
      "Verdana",
    ];
    const allFonts = [
      ...fontFaces.map((fontFace) => fontFace.family),
      ...additionalFonts,
    ];
    return [...new Set(allFonts)];
  } catch (error) {
    console.error("Error fetching fonts:", error);
    return [];
  }
};

export function generateFontAtlasTexture(gl, chars, size, fontFamily) {
  const canvas = document.createElement("canvas");
  canvas.width = size * chars.length;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { alpha: true });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `bold ${size}px ${fontFamily}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";

  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], i * size, 0);
  }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

