import argparse
import itertools
import os
import time
from PIL import Image, ImageDraw, ImageFont, ImageSequence
import numpy as np


class TransparentAnimatedGifConverter:
    _PALETTE_SLOTSET = set(range(256))

    def __init__(self, img_rgba: Image, alpha_threshold: int = 0):
        self.img_rgba = img_rgba
        self.alpha_threshold = alpha_threshold

    def _process_pixels(self):
        self.transparent_pixels = (
            np.array(self.img_rgba.getchannel("A")) <= self.alpha_threshold
        )

    def _get_palette(self):
        palette = self.img_p.getpalette()
        self.img_p_data = np.array(self.img_p)
        self.used_palette_idxs = np.unique(self.img_p_data)
        self.parsed_palette = {
            idx: tuple(palette[idx * 3 : idx * 3 + 3]) for idx in self.used_palette_idxs
        }

    def _get_similar_color_idx(self):
        old_color = self.parsed_palette[0]
        distances = {
            idx: np.sum(np.abs(np.array(old_color) - np.array(color_item)))
            for idx, color_item in self.parsed_palette.items()
            if idx != 0
        }
        return min(distances, key=distances.get)

    def _remap_palette_idx_zero(self):
        free_slots = self._PALETTE_SLOTSET - set(self.used_palette_idxs)
        new_idx = free_slots.pop() if free_slots else self._get_similar_color_idx()
        self.img_p_data[self.img_p_data == 0] = new_idx
        self.parsed_palette[new_idx] = self.parsed_palette.pop(0)

    def _find_new_color(self):
        used_colors = set(self.parsed_palette.values())
        while True:
            new_color = tuple(np.random.randint(0, 256, 3))
            if new_color not in used_colors:
                return new_color

    def _process_palette(self):
        self._get_palette()
        if 0 in self.used_palette_idxs:
            self._remap_palette_idx_zero()
        self.parsed_palette[0] = self._find_new_color()

    def _adjust_pixels(self):
        self.img_p_data[self.transparent_pixels] = 0
        self.img_p.putdata(self.img_p_data.flatten().tolist())

    def _adjust_palette(self):
        palette = list(
            itertools.chain.from_iterable(
                self.parsed_palette.get(i, (0, 0, 0)) for i in range(256)
            )
        )
        self.img_p.putpalette(palette)

    def process(self) -> Image:
        self.img_p = self.img_rgba.convert("P", palette=Image.ADAPTIVE, colors=256)
        self.img_p_data = np.array(self.img_p)
        self._process_pixels()
        self._process_palette()
        self._adjust_pixels()
        self._adjust_palette()
        self.img_p.info["transparency"] = 0
        self.img_p.info["background"] = 0
        return self.img_p


class AsciiArtConverter:
    def __init__(self, new_width, chars, font, fill):
        self._new_width = new_width
        self._chars = chars
        self._font = font
        self._fill = fill

    def _image_to_ascii(self, image):
        aspect_ratio = image.height / image.width
        new_height = int(aspect_ratio * self._new_width * 0.55)
        image = image.resize((self._new_width, new_height), Image.ANTIALIAS)

        image_grey = np.asarray(image.convert("L"))
        image_color = np.asarray(image)
        alpha_channel = np.asarray(image.split()[-1])

        scale_factor = len(self._chars) / 256
        scaled_chars = [self._chars[int(i * scale_factor)] for i in range(256)]

        output_image = Image.new("RGBA", (self._new_width * 10, new_height * 20))
        draw = ImageDraw.Draw(output_image)

        valid_pixels = np.column_stack(np.where(alpha_channel > 128))
        rectangles = []
        texts = []

        for y, x in valid_pixels:
            pixel = image_grey[y, x]
            color = tuple(image_color[y, x][:3])
            ascii_char = scaled_chars[pixel]
            x_pos, y_pos = x * 10, y * 20
            if self._fill is not None:
                rectangles.append([x_pos, y_pos, x_pos + 10, y_pos + 20])
            texts.append((x_pos, y_pos, ascii_char, color))

        for rect in rectangles:
            draw.rectangle(rect, fill=self._fill)

        for x_pos, y_pos, ascii_char, color in texts:
            draw.text((x_pos, y_pos), ascii_char, fill=color, font=self._font)

        return output_image

    def _process_gif(self, input_path, output_path):
        gif = Image.open(input_path)
        frames = []
        durations = []

        for frame in ImageSequence.Iterator(gif):
            ascii_frame = self._image_to_ascii(frame.convert("RGBA"))
            converter = TransparentAnimatedGifConverter(ascii_frame)
            processed_frame = converter.process()
            frames.append(processed_frame)
            durations.append(frame.info.get("duration", 100))

        frames[0].save(
            output_path,
            save_all=True,
            append_images=frames[1:],
            loop=0,
            duration=durations,
            disposal=2,
            transparency=0,
        )

    def process_image(self, input_path, output_path):
        if input_path.lower().endswith(".gif"):
            output_path = os.path.splitext(output_path)[0] + "_ascii.gif"
            self._process_gif(input_path, output_path)
            print(f"ASCII art GIF saved to {output_path}")
        else:
            ascii_image = self._image_to_ascii(Image.open(input_path).convert("RGBA"))
            output_path = os.path.splitext(output_path)[0] + "_ascii.png"
            ascii_image.save(output_path)
            print(f"ASCII art image saved to {output_path}")

    def process_directory(self, input_dir, output_dir):
        for filename in os.listdir(input_dir):
            if filename.lower().endswith((".png", ".jpg", ".jpeg", ".bmp", ".gif")):
                input_path = os.path.join(input_dir, filename)
                output_path = os.path.join(output_dir, os.path.splitext(filename)[0])
                self.process_image(input_path, output_path)


def main():
    parser = argparse.ArgumentParser(
        description="converts images/gifs to their ascii equivalent"
    )
    parser.add_argument("input_path", type=str)
    parser.add_argument("output_path", type=str)
    parser.add_argument("--width", type=int, default=100)
    parser.add_argument("--chars", type=str, default=".:-=+*#%@")
    parser.add_argument("--font", type=str, default=None)
    parser.add_argument("--fill", type=str, default=None)

    args = parser.parse_args()
    input_path = args.input_path
    output_path = args.output_path
    new_width = args.width
    chars = args.chars
    fill = args.fill
    font = ImageFont.truetype(args.font, 10) if args.font else ImageFont.load_default()

    converter = AsciiArtConverter(new_width, chars, font, fill)
    start_time = time.time()

    if os.path.isdir(input_path):
        if not os.path.exists(output_path):
            os.makedirs(output_path)
        converter.process_directory(input_path, output_path)
    else:
        if os.path.isdir(output_path):
            output_file = os.path.join(output_path, os.path.basename(input_path))
        else:
            output_file = output_path
        converter.process_image(input_path, output_file)

    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"Elapsed time: {elapsed_time:.2f} seconds")


if __name__ == "__main__":
    main()
