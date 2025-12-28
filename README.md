# Windows XP Style React App

A Windows XP-styled web application replica using React, emulating the look and feel of the classic OS.
Specializes in image processing features, allowing users to apply various filters such as pixel sorting, ASCII art
conversion, and color manipulation.

## Features

- **Windows & Applications**: Multiple applications can be opened in separate draggable & resizable windows.
- **Focused state**: Applications z index is properly managed across applications.
- **Ascii Processing**: Image/Gif processing to Ascii art.
- **Pixel Processing**: Incoperates Pixel Sorting to apply effects to Image/Gif's.
- **Image/Gif Processing Pipelines**: Ability to process Image/Gif's with multiple layers of processing effects which can be reordered


## Demo

![XP Style App Demo](example.gif)

## Installation

To set up the project locally, follow these steps:

1. Clone the repository:

   ```bash
   git clone https://github.com/blankprogram/jamsworld.git
   ```
2. Install dependencies:

   ```bash
   npm install
   ```
2. Start the server:

   ```bash
   npm start
   ```

## Usage

### Asciify

The **Asciify** app transforms images and GIFs into stunning ASCII art.

1. **Select a file**: Upload an image or GIF.
2. **Adjust width**: Control the width to change the ASCII art density.
3. **Choose characters**: Pick which characters will represent the image.
4. **Pick a font**: Select from preset fonts to style your ASCII art.
5. **Fill color**: Optionally, choose a background color for the characters.
6. **Upload**: Submit and wait for the image or GIF to be converted into ASCII art.

---

### Pixort

The **Pixort** app applies pixel-sorting effects to images for a unique visual style.

1. **Select a file**: Upload an image or GIF.
2. **Choose direction**: Decide the direction in which you want the pixels sorted (e.g., horizontal, vertical).
3. **Select interval type**: Choose an interval type for sorting (e.g., block, threshold).
4. **Set thresholds**: If using the threshold interval type, define the threshold values.
5. **Select sorting method**: Pick from various sorting methods, such as brightness or hue.
6. **Upload**: Submit and wait for the pixel-sorted image or GIF to appear.

---

### PixelPass

The **PixelPass** app allows you to apply multiple filters to an image in sequence, giving you full control over the effects.

1. **Select a file**: Upload an image or GIF.
2. **Add filters**: Use the "Add Filter" button to select filters.
3. **Adjust filter settings**: Click on any filter to open and modify its specific settings.
4. **Reorder filters**: Drag and drop filters to change their order of application.
5. **Apply filters**: Click "Apply Filters" and wait for the processed image or GIF to appear.


## Other

- Dont expect the best performance for processing its js afterall.
- Inspired by [ShizukuIchi's winXP project](https://github.com/ShizukuIchi/winXP).
- GIF transparency encoding isn't perfect due to the use of a third-party decoder.