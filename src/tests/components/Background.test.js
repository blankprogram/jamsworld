import React, { useState } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Background from "../../components/Background/Background";
import { DESKTOP_PATH, joinPath } from "../../fileSystem/pathUtils";

const makeItem = (name, type = "text") => ({
  title: name,
  type,
  path: joinPath(DESKTOP_PATH, name),
  icon: `${type}.png`,
});

const CREATED_ITEMS = {
  folder: ["New Folder", "folder"],
  markdown: ["New Markdown Document.md", "markdown"],
  text: ["New Text Document.txt", "text"],
};

const mountDesktop = ({
  initialItems = [],
  onCreateItem = jest.fn(),
  onDeleteItems = jest.fn().mockResolvedValue(true),
  onRenameItem = jest.fn(),
  onRequestRenameItem = jest.fn(() => true),
} = {}) => {
  function DesktopHarness() {
    const [items, setItems] = useState(initialItems);
    const [selectedPaths, setSelectedPaths] = useState([]);

    const createItem = (type) => {
      onCreateItem(type);
      const [name, itemType] = CREATED_ITEMS[type] || CREATED_ITEMS.text;
      const item = makeItem(name, itemType);
      setItems((currentItems) => [...currentItems, item]);
      return item.path;
    };

    return (
      <Background
        items={items}
        onCreateItem={createItem}
        onDeleteItems={onDeleteItems}
        onRenameItem={onRenameItem}
        onRequestRenameItem={onRequestRenameItem}
        selectedPaths={selectedPaths}
        setSelectedPaths={setSelectedPaths}
      />
    );
  }

  render(<DesktopHarness />);
  return {
    onCreateItem,
    onDeleteItems,
    onRenameItem,
    onRequestRenameItem,
  };
};

test("right-click creation enters inline rename and preserves the extension", () => {
  const { onCreateItem, onRenameItem } = mountDesktop();

  fireEvent.contextMenu(screen.getByRole("listbox", { name: "Desktop" }), {
    clientX: 40,
    clientY: 60,
  });
  fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "New" }));
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Text Document" }),
  );

  expect(onCreateItem).toHaveBeenCalledWith("text");

  const renameInput = screen.getByRole("textbox", {
    name: "Rename New Text Document.txt",
  });
  expect(renameInput).toHaveFocus();

  fireEvent.change(renameInput, { target: { value: "Portfolio Notes" } });
  fireEvent.keyDown(renameInput, { key: "Enter" });

  expect(onRenameItem).toHaveBeenCalledWith(
    expect.objectContaining({
      path: joinPath(DESKTOP_PATH, "New Text Document.txt"),
    }),
    "Portfolio Notes.txt",
  );
});

test("Ctrl-selection and Delete issue one batch deletion", async () => {
  const alpha = makeItem("Alpha.txt");
  const beta = makeItem("Beta.md", "markdown");
  const { onDeleteItems } = mountDesktop({
    initialItems: [alpha, beta],
  });

  fireEvent.pointerDown(screen.getByRole("option", { name: "Alpha.txt" }), {
    button: 0,
  });
  fireEvent.pointerDown(screen.getByRole("option", { name: "Beta.md" }), {
    button: 0,
    ctrlKey: true,
  });
  fireEvent.keyDown(screen.getByRole("listbox", { name: "Desktop" }), {
    key: "Delete",
  });

  await waitFor(() => {
    expect(onDeleteItems).toHaveBeenCalledWith([alpha, beta]);
  });
});

test("a rejected rename request does not enter inline editing", () => {
  const item = makeItem("Welcome.md", "markdown");
  const onRequestRenameItem = jest.fn(() => false);
  const { onRenameItem } = mountDesktop({
    initialItems: [item],
    onRequestRenameItem,
  });

  fireEvent.contextMenu(screen.getByRole("option", { name: "Welcome.md" }), {
    clientX: 40,
    clientY: 60,
  });
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

  expect(onRequestRenameItem).toHaveBeenCalledWith(item);
  expect(onRenameItem).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("desktop background and item menus expose distinct shared commands", () => {
  const item = makeItem("Alpha.txt");
  mountDesktop({ initialItems: [item] });

  const desktop = screen.getByRole("listbox", { name: "Desktop" });
  fireEvent.contextMenu(desktop, { clientX: 40, clientY: 60 });

  expect(desktop).not.toContainElement(screen.getByRole("menu"));
  expect(
    screen.getByRole("menuitem", { name: "Arrange Icons By" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Refresh" })).not.toHaveAttribute(
    "aria-disabled",
  );
  expect(screen.getByRole("menuitem", { name: "New" })).toHaveAttribute(
    "aria-haspopup",
    "menu",
  );
  expect(
    screen.queryByRole("menuitem", { name: "Open" }),
  ).not.toBeInTheDocument();

  fireEvent.contextMenu(screen.getByRole("option", { name: "Alpha.txt" }), {
    clientX: 80,
    clientY: 100,
  });

  expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Open With" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
  expect(
    screen.queryByRole("menuitem", { name: "New" }),
  ).not.toBeInTheDocument();
});

test("desktop background submenus expose arrange and creation commands", () => {
  mountDesktop();

  fireEvent.contextMenu(screen.getByRole("listbox", { name: "Desktop" }), {
    clientX: 40,
    clientY: 60,
  });
  fireEvent.mouseEnter(
    screen.getByRole("menuitem", { name: "Arrange Icons By" }),
  );

  expect(screen.getByRole("menuitem", { name: "Name" })).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Size" })).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Type" })).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Modified" })).toBeInTheDocument();
  expect(
    screen.getByRole("menuitem", { name: "Auto Arrange" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("menuitem", { name: "Align to Grid" }),
  ).toBeInTheDocument();

  fireEvent.mouseEnter(screen.getByRole("menuitem", { name: "New" }));

  expect(screen.getByRole("menuitem", { name: "Folder" })).toBeInTheDocument();
  expect(
    screen.getByRole("menuitem", { name: "Text Document" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("menuitem", { name: "Markdown Document" }),
  ).toBeInTheDocument();
});

test("submenus support keyboard opening, return, and menu dismissal", () => {
  mountDesktop();

  fireEvent.contextMenu(screen.getByRole("listbox", { name: "Desktop" }), {
    clientX: 40,
    clientY: 60,
  });

  const newMenuItem = screen.getByRole("menuitem", { name: "New" });
  fireEvent.keyDown(newMenuItem, { key: "ArrowRight" });
  expect(screen.getByRole("menuitem", { name: "Folder" })).toBeInTheDocument();

  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Folder" }), {
    key: "ArrowLeft",
  });
  expect(
    screen.queryByRole("menuitem", { name: "Folder" }),
  ).not.toBeInTheDocument();
  expect(newMenuItem).toHaveFocus();

  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
