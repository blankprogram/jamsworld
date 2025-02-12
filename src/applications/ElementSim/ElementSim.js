function ElementSim({ isFocused }) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      >
        <iframe
          src="https://blankprogram.github.io/elementsim/"
          title="sim"
          style={{
            width: '100%',
            height: '100%',
            pointerEvents: isFocused ? 'auto' : 'none',
          }}
        />
      </div>
    );
  }
  
  export default ElementSim;
  