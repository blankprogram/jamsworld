const generateCartoonyA = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ff6347';
  ctx.font = 'bold 50px Comic Sans MS, Comic Sans, cursive';

  ctx.textAlign = 'center';

  ctx.fillText('A', canvas.width / 2, canvas.height);

  return canvas.toDataURL('image/png');
};


const generatePixort = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');

  const squareSize = 20;
  const offset = 5;

  ctx.fillStyle = 'red';
  ctx.fillRect(offset, offset, squareSize, squareSize);

  ctx.fillStyle = 'green';
  ctx.fillRect(
      canvas.width - offset - squareSize, offset, squareSize, squareSize);

  ctx.fillStyle = 'blue';
  ctx.fillRect(
      canvas.width - offset - squareSize, canvas.height - offset - squareSize,
      squareSize, squareSize);

  return canvas.toDataURL('image/png');
};

const generatePixelPass = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');

  const squareSize = 9;
  const offset = 5;
  const numSquares = 5;

  for (let y = 0; y < numSquares; y++) {
    for (let x = 0; x < numSquares; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? 'black' : 'white';
      ctx.fillRect(
          offset + x * squareSize, offset + y * squareSize, squareSize,
          squareSize);
    }
  }

  return canvas.toDataURL('image/png');
};

export const getAppIcon = (appName) => {
  switch (appName) {
    case 'Asciify':
      return generateCartoonyA();

    case 'Paint':
      return require('../assets/Icons/paint.png');

    case 'Minesweeper':
      return require('../assets/Icons/minesweeper.png');

    case 'Winamp':
      return require('../assets/Icons/winamp.png');

    case 'ElementSim':
      return require('../assets/Icons/sand.png');

    case 'Pixort':
      return generatePixort();

    case 'PixelPass':
      return generatePixelPass();

    case 'Notepad':
      return require('../assets/Icons/notepad.png');
    case 'Minecraft':
      return require('../assets/Icons/minecraft.png');
    case 'Internet Explorer':
      return require('../assets/Icons/internetexplorer.png');

    default:
      return require('../assets/Icons/start.png');
  }
};
