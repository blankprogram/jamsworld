import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Notepad from "../../applications/Notepad/Notepad";
import { DESKTOP_PATH, joinPath } from "../../fileSystem/pathUtils";

jest.mock("react-markdown", () => {
  const ReactModule = require("react");
  return ({ children }) =>
    ReactModule.createElement("div", { "data-testid": "markdown-preview" }, children);
});
jest.mock("rehype-raw", () => () => {});

const FILE_PATH = joinPath(DESKTOP_PATH, "Welcome.md");

const mountNotepad = ({ canSave = false, defaultMode = "preview" } = {}) => {
  const fileNode = {
    path: FILE_PATH,
    name: "Welcome.md",
    type: "markdown",
    content: "# Welcome",
    readOnly: !canSave,
  };
  const fileSystemRuntime = {
    getNode: jest.fn(() => fileNode),
    canEditNode: jest.fn(() => canSave),
    writeFile: jest.fn(),
  };

  render(
    <Notepad
      windowProps={{ filePath: FILE_PATH, defaultMode }}
      fileSystemRuntime={fileSystemRuntime}
    />,
  );

  return { fileSystemRuntime };
};

test("allows protected files to use a temporary editable draft", () => {
  const { fileSystemRuntime } = mountNotepad();

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "# Changed locally" },
  });

  const saveCommand = screen.getByRole("button", { name: "Save" });
  expect(saveCommand).toHaveAttribute("aria-disabled", "true");

  fireEvent.click(saveCommand);
  expect(fileSystemRuntime.writeFile).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  expect(screen.getByTestId("markdown-preview")).toHaveTextContent(
    "# Changed locally",
  );
});

test("saves writable files and can revert unsaved drafts", () => {
  const { fileSystemRuntime } = mountNotepad({
    canSave: true,
    defaultMode: "edit",
  });
  const editor = screen.getByRole("textbox");

  fireEvent.change(editor, { target: { value: "# Updated" } });
  fireEvent.click(screen.getByRole("button", { name: "Revert" }));
  expect(editor).toHaveValue("# Welcome");

  fireEvent.change(editor, { target: { value: "# Saved" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(fileSystemRuntime.writeFile).toHaveBeenCalledWith(
    FILE_PATH,
    "# Saved",
  );
});
