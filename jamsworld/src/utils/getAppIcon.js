const generateCartoonyA = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
  
    ctx.fillStyle = '#ff6347';
    ctx.font = 'bold 48px Comic Sans MS, Comic Sans, cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', canvas.width / 2, canvas.height / 2);
  
    return canvas.toDataURL('image/png');
  };
  
  export const getAppIcon = (appName) => {
    switch (appName) {
      case 'AsciiApp':
        return generateCartoonyA();
      case 'AnotherApp':
        return require('../assets/Icons/heart-icon.png');
      default:
        return require('../assets/Icons/start.png');
    }
  };
  