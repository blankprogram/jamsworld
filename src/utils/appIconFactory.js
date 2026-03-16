function makeCanvas(size = 50) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function toDataUrl(canvas) {
  if (!canvas) return "";
  return canvas.toDataURL("image/png");
}

export function createAsciifyIcon() {
  const canvas = makeCanvas(50);
  if (!canvas) return "";
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ff6347";
  ctx.font = "bold 50px Comic Sans MS, Comic Sans, cursive";
  ctx.textAlign = "center";
  ctx.fillText("A", canvas.width / 2, canvas.height);

  return toDataUrl(canvas);
}

export function createPixortIcon() {
  const canvas = makeCanvas(50);
  if (!canvas) return "";
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const squareSize = 20;
  const offset = 5;

  ctx.fillStyle = "red";
  ctx.fillRect(offset, offset, squareSize, squareSize);

  ctx.fillStyle = "green";
  ctx.fillRect(
    canvas.width - offset - squareSize,
    offset,
    squareSize,
    squareSize,
  );

  ctx.fillStyle = "blue";
  ctx.fillRect(
    canvas.width - offset - squareSize,
    canvas.height - offset - squareSize,
    squareSize,
    squareSize,
  );

  return toDataUrl(canvas);
}

export function createPixelPassIcon() {
  const canvas = makeCanvas(50);
  if (!canvas) return "";
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const squareSize = 9;
  const offset = 5;
  const numSquares = 5;

  for (let y = 0; y < numSquares; y += 1) {
    for (let x = 0; x < numSquares; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "black" : "white";
      ctx.fillRect(
        offset + x * squareSize,
        offset + y * squareSize,
        squareSize,
        squareSize,
      );
    }
  }

  return toDataUrl(canvas);
}
