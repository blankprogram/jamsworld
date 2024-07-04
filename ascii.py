import itertools
from random import randrange
import sys
import os
from PIL import Image, ImageDraw, ImageFont, ImageSequence
import numpy as np
import time



class TransparentAnimatedGifConverter:
    _PALETTE_SLOTSET = set(range(256))

    def __init__(self, img_rgba: Image, alpha_threshold: int = 0):
        self.img_rgba = img_rgba
        self.alpha_threshold = alpha_threshold

    def _process_pixels(self):
        self.transparent_pixels = {idx for idx, alpha in enumerate(self.img_rgba.getchannel('A').getdata()) if alpha <= self.alpha_threshold}

    def _get_palette(self):
        palette = self.img_p.getpalette()
        self.used_palette_idxs = set(self.img_p_data)
        self.parsed_palette = {idx: tuple(palette[idx * 3:idx * 3 + 3]) for idx in self.used_palette_idxs}

    def _get_similar_color_idx(self):
        old_color = self.parsed_palette[0]
        distances = {idx: sum(abs(old_color[i] - color_item[i]) for i in range(3))
                     for idx, color_item in self.parsed_palette.items() if idx != 0}
        return min(distances, key=distances.get)

    def _remap_palette_idx_zero(self):
        free_slots = self._PALETTE_SLOTSET - self.used_palette_idxs
        new_idx = free_slots.pop() if free_slots else self._get_similar_color_idx()
        self.used_palette_idxs.add(new_idx)
        self.img_p_data = bytearray(new_idx if p == 0 else p for p in self.img_p_data)
        self.parsed_palette[new_idx] = self.parsed_palette.pop(0)

    def _find_new_color(self):
        used_colors = set(self.parsed_palette.values())
        while True:
            new_color = tuple(randrange(256) for _ in range(3))
            if new_color not in used_colors:
                return new_color

    def _process_palette(self):
        self._get_palette()
        if 0 in self.used_palette_idxs:
            self._remap_palette_idx_zero()
        self.parsed_palette[0] = self._find_new_color()

    def _adjust_pixels(self):
        self.img_p_data = bytearray(self.img_p_data)
        for idx in self.transparent_pixels:
            self.img_p_data[idx] = 0
        self.img_p.putdata(self.img_p_data)

    def _adjust_palette(self):
        palette = list(itertools.chain.from_iterable(self.parsed_palette.get(i, (0, 0, 0)) for i in range(256)))
        self.img_p.putpalette(palette)

    def process(self) -> Image:
        self.img_p = self.img_rgba.convert('P', palette=Image.ADAPTIVE, colors=256)
        self.img_p_data = bytearray(self.img_p.tobytes())
        self._process_pixels()
        self._process_palette()
        self._adjust_pixels()
        self._adjust_palette()
        self.img_p.info['transparency'] = 0
        self.img_p.info['background'] = 0
        return self.img_p


class AsciiArtConverter:
    def __init__(self, new_width, ascii_chars, font, fill):
        self._new_width = new_width
        self._ascii_chars = ascii_chars
        self._font = font
        self._fill = fill

    def _image_to_ascii(self, image):
        aspect_ratio = image.height / image.width
        new_height = int(aspect_ratio * self._new_width * 0.55)
        image = image.resize((self._new_width, new_height), Image.ANTIALIAS).convert('RGBA')

        image_grey = np.asarray(image.convert('L'))
        image_color = np.asarray(image)
        alpha_channel = np.asarray(image.split()[-1])

        scale_factor = len(self._ascii_chars) / 256

        output_image = Image.new('RGBA', (self._new_width * 10, new_height * 20))
        draw = ImageDraw.Draw(output_image)

        for y in range(new_height):
            for x in range(self._new_width):
                pixel = image_grey[y, x]
                color = image_color[y, x]
                ascii_char = self._ascii_chars[int(pixel * scale_factor)]
                if alpha_channel[y, x] > 128:
                    if self._fill != "none":
                        draw.rectangle([x * 10, y * 20, (x + 1) * 10, (y + 1) * 20], fill=self._fill)
                    draw.text((x * 10, y * 20), ascii_char, fill=tuple(color[:3]), font=self._font)

        return output_image

    def _process_gif(self, input_path, output_path):
        gif = Image.open(input_path)
        frames = []
        durations = []

        for frame in ImageSequence.Iterator(gif):
            ascii_frame = self._image_to_ascii(frame)
            frames.append(ascii_frame)
            durations.append(frame.info.get('duration', 100))

        processed_frames = []
        for frame in frames:
            converter = TransparentAnimatedGifConverter(frame)
            processed_frame = converter.process()
            processed_frames.append(processed_frame)

        processed_frames[0].save(
            output_path,
            save_all=True,
            append_images=processed_frames[1:],
            loop=0,
            duration=durations,
            disposal=2
        )

    def process_image(self, input_path, output_path):
        if input_path.lower().endswith('.gif'):
            output_path = os.path.splitext(output_path)[0] + "_ascii.gif"
            self._process_gif(input_path, output_path)
            print(f"ASCII art GIF saved to {output_path}")
        else:
            ascii_image = self._image_to_ascii(Image.open(input_path).convert('RGBA'))
            output_path = os.path.splitext(output_path)[0] + "_ascii.png"
            ascii_image.save(output_path)
            print(f"ASCII art image saved to {output_path}")

    def process_directory(self, input_dir, output_dir):
        for filename in os.listdir(input_dir):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
                input_path = os.path.join(input_dir, filename)
                output_path = os.path.join(output_dir, os.path.splitext(filename)[0])
                self.process_image(input_path, output_path)


def main():
    if len(sys.argv) < 3:
        print("Usage: script.py <input file/directory> <output file/directory> [new_width] [ascii_chars] [font_path] [font_colour]")
        return

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    new_width = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    ascii_chars = sys.argv[4] if len(sys.argv) > 4 else ".:-=+*#%@"
    font = ImageFont.truetype(sys.argv[5], 10) if len(sys.argv) > 5 else ImageFont.load_default()
    fill = sys.argv[6] if len(sys.argv) > 6 else "none"

    converter = AsciiArtConverter(new_width, ascii_chars, font, fill)
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


if __name__ == '__main__':
    main()
