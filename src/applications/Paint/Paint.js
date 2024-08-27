function Paint({ isFocused }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <iframe
        src="https://jspaint.app"
        title="paint"
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: isFocused ? 'auto' : 'none',
        }}
      />
    </div>
  );
}

export default Paint;
