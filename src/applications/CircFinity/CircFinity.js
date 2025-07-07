function Circfinity({ isFocused }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <iframe
        src="https://blankprogram.github.io/circfinity/"
        title="circfinity"
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: isFocused ? "auto" : "none",
          margin: 0,
          padding: 0,
          border: "none",
        }}
      />
    </div>
  );
}

export default Circfinity;

