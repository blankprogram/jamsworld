import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Explorer from "../../applications/Explorer/Explorer";
import {
  DESKTOP_PATH,
  FILE_SYSTEM_ROOT_PATH,
  joinPath,
} from "../../fileSystem/pathUtils";

const ALPHA_PATH = joinPath(DESKTOP_PATH, "Alpha.txt");
const BETA_PATH = joinPath(DESKTOP_PATH, "Beta.md");
const PROJECTS_PATH = joinPath(DESKTOP_PATH, "Projects");

const createRect = (left, top, right, bottom) => ({
  left,
  top,
  right,
  bottom,
  width: right - left,
  height: bottom - top,
  x: left,
  y: top,
  toJSON: () => {},
});

const createFileSystemRuntime = () => {
  const nodes = {
    [FILE_SYSTEM_ROOT_PATH]: {
      path: FILE_SYSTEM_ROOT_PATH,
      name: "Local Disk (C:)",
      type: "folder",
      system: true,
    },
    [DESKTOP_PATH]: {
      path: DESKTOP_PATH,
      parentPath: FILE_SYSTEM_ROOT_PATH,
      name: "Desktop",
      type: "folder",
      system: true,
    },
    [ALPHA_PATH]: {
      path: ALPHA_PATH,
      parentPath: DESKTOP_PATH,
      name: "Alpha.txt",
      type: "text",
      system: false,
      readOnly: false,
    },
    [BETA_PATH]: {
      path: BETA_PATH,
      parentPath: DESKTOP_PATH,
      name: "Beta.md",
      type: "markdown",
      system: false,
      readOnly: false,
    },
    [PROJECTS_PATH]: {
      path: PROJECTS_PATH,
      parentPath: DESKTOP_PATH,
      name: "Projects",
      type: "folder",
      system: false,
      readOnly: true,
    },
  };

  return {
    getNode: jest.fn((path) => nodes[path] || null),
    getChildren: jest.fn((path) =>
      Object.values(nodes).filter((node) => node.parentPath === path),
    ),
    isNodeProtected: jest.fn((node) => Boolean(node?.system || node?.readOnly)),
    canCreateChildren: jest.fn(
      (node) => node?.type === "folder" && node?.allowChildren !== false,
    ),
    canOpenInNotepad: jest.fn((node) =>
      ["text", "markdown"].includes(node?.type),
    ),
    canEditNode: jest.fn((node) => ["text", "markdown"].includes(node?.type)),
    createFolder: jest.fn((parentPath) => {
      const path = `${parentPath}/New Folder`;
      nodes[path] = {
        path,
        parentPath,
        name: "New Folder",
        type: "folder",
        system: false,
        readOnly: false,
      };
      return path;
    }),
    createFile: jest.fn((parentPath, { fileType }) => {
      const name =
        fileType === "markdown"
          ? "New Markdown Document.md"
          : "New Text Document.txt";
      const path = `${parentPath}/${name}`;
      nodes[path] = {
        path,
        parentPath,
        name,
        type: fileType,
        system: false,
        readOnly: false,
      };
      return path;
    }),
    renameNode: jest.fn(),
    deleteNodes: jest.fn(),
  };
};

const getItem = (name) =>
  screen.getByRole("option", { name: new RegExp(name.replace(".", "\\.")) });

test("the C drive address opens the filesystem root", () => {
  render(<Explorer fileSystemRuntime={createFileSystemRuntime()} />);

  const addressInput = screen.getByRole("textbox", { name: "Address" });
  fireEvent.change(addressInput, { target: { value: "C:\\" } });
  fireEvent.click(screen.getByRole("button", { name: "Go" }));

  expect(addressInput).toHaveValue("C:\\");
  expect(getItem("Desktop")).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /Alpha/ })).not.toBeInTheDocument();
});

test("Back visits the parent and Forward returns to the child", () => {
  render(<Explorer fileSystemRuntime={createFileSystemRuntime()} />);

  const addressInput = screen.getByRole("textbox", { name: "Address" });
  fireEvent.doubleClick(getItem("Projects"));
  expect(addressInput).toHaveValue("C:\\Desktop\\Projects");

  fireEvent.click(screen.getByRole("button", { name: /Back/ }));
  expect(addressInput).toHaveValue("C:\\Desktop");

  fireEvent.click(screen.getByRole("button", { name: "Forward" }));
  expect(addressInput).toHaveValue("C:\\Desktop\\Projects");
});

test("direct navigation clears the Forward stack", () => {
  render(<Explorer fileSystemRuntime={createFileSystemRuntime()} />);

  fireEvent.doubleClick(getItem("Projects"));
  fireEvent.click(screen.getByRole("button", { name: /Back/ }));
  fireEvent.click(screen.getByRole("button", { name: "Up" }));

  expect(screen.getByRole("textbox", { name: "Address" })).toHaveValue("C:\\");
  expect(screen.getByRole("button", { name: "Forward" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
});

test("plain click replaces selection and Ctrl-click toggles items", () => {
  render(<Explorer fileSystemRuntime={createFileSystemRuntime()} />);

  const alpha = getItem("Alpha");
  const beta = getItem("Beta");

  fireEvent.pointerDown(alpha, { button: 0 });
  fireEvent.pointerDown(beta, { button: 0, ctrlKey: true });

  expect(alpha).toHaveAttribute("aria-selected", "true");
  expect(beta).toHaveAttribute("aria-selected", "true");

  fireEvent.pointerDown(alpha, { button: 0, ctrlKey: true });
  expect(alpha).toHaveAttribute("aria-selected", "false");
  expect(beta).toHaveAttribute("aria-selected", "true");

  fireEvent.pointerDown(alpha, { button: 0 });
  expect(alpha).toHaveAttribute("aria-selected", "true");
  expect(beta).toHaveAttribute("aria-selected", "false");

  const listbox = screen.getByRole("listbox");
  fireEvent.pointerDown(listbox, { button: 0, pointerId: 1 });
  expect(alpha).toHaveAttribute("aria-selected", "false");
  fireEvent.pointerUp(listbox, { pointerId: 1 });
});

test("selection remains intact when the view mode changes", () => {
  render(<Explorer fileSystemRuntime={createFileSystemRuntime()} />);

  fireEvent.pointerDown(getItem("Alpha"), { button: 0 });
  fireEvent.pointerDown(getItem("Beta"), { button: 0, ctrlKey: true });

  ["Thumbnails", "Icons", "List", "Details"].forEach((viewMode) => {
    fireEvent.change(screen.getByLabelText("View"), {
      target: { value: viewMode },
    });
    expect(getItem("Alpha")).toHaveAttribute("aria-selected", "true");
    expect(getItem("Beta")).toHaveAttribute("aria-selected", "true");
  });

  expect(screen.getByText("2 items selected")).toBeInTheDocument();
});

test("dragging over item bounds creates a marquee selection", () => {
  render(<Explorer fileSystemRuntime={createFileSystemRuntime()} />);

  const listbox = screen.getByRole("listbox");
  const alpha = getItem("Alpha");
  const beta = getItem("Beta");
  listbox.getBoundingClientRect = () => createRect(0, 0, 500, 400);
  alpha.getBoundingClientRect = () => createRect(20, 20, 100, 80);
  beta.getBoundingClientRect = () => createRect(200, 20, 280, 80);

  fireEvent.pointerDown(listbox, {
    button: 0,
    pointerId: 1,
    clientX: 10,
    clientY: 10,
  });
  fireEvent.pointerMove(listbox, {
    pointerId: 1,
    clientX: 120,
    clientY: 100,
  });

  expect(alpha).toHaveAttribute("aria-selected", "true");
  expect(beta).toHaveAttribute("aria-selected", "false");
  expect(screen.getByTestId("selection-marquee")).toBeInTheDocument();

  fireEvent.pointerUp(listbox, { pointerId: 1 });
  expect(screen.queryByTestId("selection-marquee")).not.toBeInTheDocument();
});

test("Delete sends writable selected items through one batch action", async () => {
  const fileSystemRuntime = createFileSystemRuntime();
  const windowRuntime = {
    openDialog: jest.fn().mockResolvedValue(true),
  };
  render(
    <Explorer
      fileSystemRuntime={fileSystemRuntime}
      windowRuntime={windowRuntime}
    />,
  );

  fireEvent.pointerDown(getItem("Alpha"), { button: 0 });
  fireEvent.pointerDown(getItem("Beta"), { button: 0, ctrlKey: true });
  const listbox = screen.getByRole("listbox");
  fireEvent.keyDown(listbox, { key: "Delete" });

  await waitFor(() => {
    expect(windowRuntime.openDialog).toHaveBeenCalledWith(
      "system-dialog",
      expect.objectContaining({
        windowProps: expect.objectContaining({
          message: [
            "Are you sure you want to send 2 item(s) to the Recycle Bin?",
          ],
        }),
      }),
    );
  });
  await waitFor(() => {
    expect(fileSystemRuntime.deleteNodes).toHaveBeenCalledWith([
      ALPHA_PATH,
      BETA_PATH,
    ]);
  });
});

test("deleting a protected preset opens the system error dialog", async () => {
  const fileSystemRuntime = createFileSystemRuntime();
  const windowRuntime = {
    openDialog: jest.fn().mockResolvedValue(true),
  };
  render(
    <Explorer
      fileSystemRuntime={fileSystemRuntime}
      windowRuntime={windowRuntime}
    />,
  );

  fireEvent.pointerDown(getItem("Projects"), { button: 0 });
  fireEvent.keyDown(screen.getByRole("listbox"), { key: "Delete" });

  await waitFor(() => {
    expect(windowRuntime.openDialog).toHaveBeenCalledWith(
      "system-dialog",
      expect.objectContaining({
        titleOverride: "Error",
        windowProps: expect.objectContaining({
          variant: "error",
          message: [
            "This folder is a system folder and cannot be modified.",
          ],
          showCancel: false,
        }),
      }),
    );
  });
  expect(fileSystemRuntime.deleteNodes).not.toHaveBeenCalled();
});

test.each([
  ["Make a new folder", "New Folder", "New Folder", "Portfolio Notes"],
  [
    "Make a new text file",
    "New Text Document.txt",
    "New Text Document.txt",
    "Portfolio Notes.txt",
  ],
  [
    "Make a new markdown file",
    "New Markdown Document.md",
    "New Markdown Document.md",
    "Portfolio Notes.md",
  ],
])(
  "%s starts inline rename mode",
  (actionLabel, defaultName, visibleName, committedName) => {
    const fileSystemRuntime = createFileSystemRuntime();
    const { rerender } = render(
      <Explorer fileSystemRuntime={fileSystemRuntime} />,
    );

    fireEvent.click(screen.getByText(actionLabel));
    rerender(<Explorer fileSystemRuntime={{ ...fileSystemRuntime }} />);

    const renameInput = screen.getByRole("textbox", {
      name: `Rename ${defaultName}`,
    });
    expect(renameInput).toHaveFocus();
    expect(renameInput).toHaveValue(visibleName);

    fireEvent.change(renameInput, { target: { value: "Portfolio Notes" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    expect(fileSystemRuntime.renameNode).toHaveBeenCalledWith(
      joinPath(DESKTOP_PATH, defaultName),
      committedName,
    );
  },
);

test("F2 renames the selected item inline without using a browser prompt", () => {
  const fileSystemRuntime = createFileSystemRuntime();
  const promptSpy = jest.spyOn(window, "prompt");
  render(<Explorer fileSystemRuntime={fileSystemRuntime} />);

  expect(screen.queryByText("Alpha.txt")).not.toBeInTheDocument();
  expect(screen.getByText("Alpha")).toBeInTheDocument();

  fireEvent.pointerDown(getItem("Alpha"), { button: 0 });
  fireEvent.keyDown(screen.getByRole("listbox"), { key: "F2" });

  const renameInput = screen.getByRole("textbox", {
    name: "Rename Alpha.txt",
  });
  expect(renameInput).toHaveValue("Alpha.txt");
  fireEvent.change(renameInput, { target: { value: "Notes.txt" } });
  fireEvent.keyDown(renameInput, { key: "Enter" });

  expect(fileSystemRuntime.renameNode).toHaveBeenCalledWith(
    ALPHA_PATH,
    "Notes.txt",
  );
  expect(promptSpy).not.toHaveBeenCalled();
  promptSpy.mockRestore();
});

test("empty space and items use the shared folder and item menus", () => {
  const fileSystemRuntime = createFileSystemRuntime();
  render(<Explorer fileSystemRuntime={fileSystemRuntime} />);

  fireEvent.contextMenu(screen.getByRole("listbox"), {
    clientX: 40,
    clientY: 60,
  });

  expect(
    screen.getByRole("menuitem", { name: "Arrange Icons By" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "New" })).toHaveAttribute(
    "aria-haspopup",
    "menu",
  );
  expect(
    screen.queryByRole("menuitem", { name: "Open" }),
  ).not.toBeInTheDocument();

  fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "New" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Text Document" }));

  expect(fileSystemRuntime.createFile).toHaveBeenCalledWith(DESKTOP_PATH, {
    fileType: "text",
  });

  fireEvent.contextMenu(getItem("Alpha"), {
    clientX: 80,
    clientY: 100,
  });

  expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
  expect(
    screen.queryByRole("menuitem", { name: "New" }),
  ).not.toBeInTheDocument();
});
