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

function EmbeddedWebampWindow() {
  return <div data-testid="embedded-webamp" id="main-window" className="window" />;
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

test("keeps embedded Webamp outside the XP frame wrapper", () => {
  render(
    <Window
      title="Winamp"
      onFocus={jest.fn()}
      onClose={jest.fn()}
      onMinimize={jest.fn()}
      onToggleMaximize={jest.fn()}
      onRectChange={jest.fn()}
      isFocused
      isMinimized={false}
      maximized={false}
      useStyledWindow={false}
      rect={{ x: 0, y: 0, width: 350, height: 240 }}
    >
      <EmbeddedWebampWindow />
    </Window>,
  );

  expect(screen.getByTestId("embedded-webamp")).toBeInTheDocument();
  const frame = screen.getByTestId("window-frame");

  expect(frame).toHaveAttribute("data-window-root", "true");
  expect(frame).toHaveAttribute("data-window-frame", "none");
  expect(frame).toHaveAttribute(
    "style",
    expect.stringContaining("padding: 0px"),
  );
  expect(frame).toHaveAttribute(
    "style",
    expect.stringContaining("background: transparent"),
  );
  expect(frame).toHaveAttribute(
    "style",
    expect.stringContaining("border: 0px"),
  );
  expect(frame).toHaveAttribute(
    "style",
    expect.stringContaining("border-radius: 0"),
  );
  expect(frame).toHaveAttribute(
    "style",
    expect.stringContaining("box-shadow: none"),
  );
});
