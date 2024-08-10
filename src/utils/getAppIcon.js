const generateCartoonyA = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ff6347';
  ctx.font = 'bold 48px Comic Sans MS, Comic Sans, cursive';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL('image/png');
};

const generatePixels = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');

  const squareSize = 30;
  const offset = 20;

  ctx.fillStyle = 'red';
  ctx.fillRect(offset, offset, squareSize, squareSize);

  ctx.fillStyle = 'green';
  ctx.fillRect(canvas.width - offset - squareSize, offset, squareSize, squareSize);

  ctx.fillStyle = 'blue';
  ctx.fillRect(canvas.width - offset - squareSize, canvas.height - offset - squareSize, squareSize, squareSize);


  return canvas.toDataURL('image/png');
};

export const getAppIcon = (appName) => {
  switch (appName) {
      case 'Asciify':
          return generateCartoonyA();
      case 'Paint':
          return require('../assets/Icons/paint.png');
      case 'Pixort':
          return generatePixels();
      default:
          return require('../assets/Icons/start.png');
  }
};
