import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import FileBrowserDialog from "../../components/FileBrowserDialog/FileBrowserDialog";

const folder = {
  path: "C:/My Pictures/Exports",
  parentPath: "C:/My Pictures",
  name: "Exports",
  type: "folder",
};

const configFile = {
  path: "C:/My Pictures/pixelpass.json",
  parentPath: "C:/My Pictures",
  name: "pixelpass.json",
  type: "text",
  content: "{}",
};

function renderBrowser(mode, resolveDialog) {
  const nodes = [folder, configFile];
  const fileSystemRuntime = {
    getChildren: () => nodes,
    getNode: (path) => nodes.find((node) => node.path === path) || null,
  };

  render(
    <FileBrowserDialog
      windowProps={{ mode, defaultPath: "C:/My Pictures" }}
      windowRuntime={{ resolveDialog }}
      fileSystemRuntime={fileSystemRuntime}
    />,
  );
}

test("double-clicking a configuration opens it in load mode", () => {
  const resolveDialog = jest.fn();
  renderBrowser("load", resolveDialog);

  fireEvent.doubleClick(
    screen.getByRole("option", { name: "pixelpass.json" }),
  );

  expect(resolveDialog).toHaveBeenCalledWith({
    action: "load",
    path: configFile.path,
  });
});

test("double-clicking a configuration saves it in save mode", () => {
  const resolveDialog = jest.fn();
  renderBrowser("save", resolveDialog);

  fireEvent.doubleClick(
    screen.getByRole("option", { name: "pixelpass.json" }),
  );

  expect(resolveDialog).toHaveBeenCalledWith({
    action: "save",
    parentPath: "C:/My Pictures",
    name: configFile.name,
  });
});
