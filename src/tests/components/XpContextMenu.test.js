import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import XpContextMenu, {
  useXpContextMenu,
  XpContextMenuItem,
} from "../../components/XpContextMenu/XpContextMenu";

function ContextMenuHarness({ label }) {
  const { contextMenu, openContextMenu } = useXpContextMenu();

  return (
    <>
      <button
        type="button"
        onContextMenu={(event) => {
          event.preventDefault();
          openContextMenu({
            x: event.clientX,
            y: event.clientY,
          });
        }}
      >
        Open {label}
      </button>
      <XpContextMenu menu={contextMenu}>
        <XpContextMenuItem>{label}</XpContextMenuItem>
      </XpContextMenu>
    </>
  );
}

test("opening a context menu closes the previously active menu", () => {
  render(
    <>
      <ContextMenuHarness label="Desktop action" />
      <ContextMenuHarness label="Explorer action" />
    </>,
  );

  fireEvent.contextMenu(
    screen.getByRole("button", { name: "Open Desktop action" }),
  );
  expect(
    screen.getByRole("menuitem", { name: "Desktop action" }),
  ).toBeInTheDocument();

  fireEvent.contextMenu(
    screen.getByRole("button", { name: "Open Explorer action" }),
  );
  expect(
    screen.queryByRole("menuitem", { name: "Desktop action" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("menuitem", { name: "Explorer action" }),
  ).toBeInTheDocument();
});
