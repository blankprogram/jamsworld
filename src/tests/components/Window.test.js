import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import Window from "../../components/Window/Window";

function PointerBlockingContent() {
  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      Explorer contents
    </button>
  );
}

test("focuses before child pointer handlers prevent or stop the event", () => {
  const onFocus = jest.fn();

  render(
    <Window
      title="Explorer"
      icon="explorer.png"
      onFocus={onFocus}
      onClose={jest.fn()}
      onMinimize={jest.fn()}
      onToggleMaximize={jest.fn()}
      onRectChange={jest.fn()}
      isFocused={false}
      isMinimized={false}
      maximized={false}
      rect={{ x: 20, y: 20, width: 600, height: 400 }}
    >
      <PointerBlockingContent />
    </Window>,
  );

  fireEvent.pointerDown(
    screen.getByRole("button", { name: "Explorer contents" }),
    { button: 0 },
  );

  expect(onFocus).toHaveBeenCalledTimes(1);
});
