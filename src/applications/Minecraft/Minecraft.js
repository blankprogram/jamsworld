function Minecraft({ isFocused }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <iframe
        src="https://minecraft-threejs.netlify.app/"
        title="sim"
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

export default Minecraft;
