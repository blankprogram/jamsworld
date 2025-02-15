function Minesweeper({ isFocused }) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <iframe
          src="https://mines.now.sh"
          title="paint"
          style={{
            width: '100%',
            height: '100%',
            pointerEvents: isFocused ? 'auto' : 'none',
            margin: 0,
            padding: 0,
            border: 'none',
          }}
        />
      </div>
    );
  }
  
  export default Minesweeper;
  