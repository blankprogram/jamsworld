import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import SystemConfirmDialog from "../../components/SystemConfirmDialog/SystemConfirmDialog";

const renderDialog = (windowProps = {}) => {
  const windowRuntime = {
    resolveDialog: jest.fn(),
  };
  render(
    <SystemConfirmDialog
      windowProps={{
        message: ["Delete this item?"],
        confirmLabel: "Yes",
        cancelLabel: "No",
        ...windowProps,
      }}
      windowRuntime={windowRuntime}
    />,
  );
  return windowRuntime;
};

test("focuses the confirm action so Enter cannot reach the owner window", () => {
  renderDialog();

  expect(screen.getByRole("button", { name: "Yes" })).toHaveFocus();
});

test("keeps keyboard focus inside the modal actions", () => {
  renderDialog();
  const confirmButton = screen.getByRole("button", { name: "Yes" });
  const cancelButton = screen.getByRole("button", { name: "No" });

  cancelButton.focus();
  fireEvent.keyDown(cancelButton, { key: "Tab" });
  expect(confirmButton).toHaveFocus();

  fireEvent.keyDown(confirmButton, { key: "Tab", shiftKey: true });
  expect(cancelButton).toHaveFocus();
});

test("Escape resolves the dialog without confirming", () => {
  const windowRuntime = renderDialog();

  fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });

  expect(windowRuntime.resolveDialog).toHaveBeenCalledWith(false);
});
