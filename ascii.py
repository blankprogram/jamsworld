import sys
import os
from PIL import Image, ImageDraw, ImageFont, ImageSequence
import numpy as np
import time


def image_to_ascii(image, new_width, ascii_chars):
    aspect_ratio = image.height / image.width
    new_height = int(aspect_ratio * new_width * 0.55)
    image = image.resize((new_width, new_height), Image.ANTIALIAS).convert('RGBA')

    image_grey = np.asarray(image.convert('L'))
    image_color = np.asarray(image)
    alpha_channel = np.asarray(image.split()[-1])

    scale_factor = len(ascii_chars) / 256

    output_image = Image.new('RGBA', (new_width * 10, new_height * 20))
    draw = ImageDraw.Draw(output_image)
    font = ImageFont.load_default()

    for y in range(new_height):
        for x in range(new_width):
            pixel = image_grey[y, x]
            color = image_color[y, x]
            ascii_char = ascii_chars[int(pixel * scale_factor)]
            if alpha_channel[y, x] > 128:
                draw.text((x * 10, y * 20), ascii_char, fill=tuple(color[:3]), font=font)

    return output_image


def process_gif(input_path, output_path, new_width, ascii_chars):
    gif = Image.open(input_path)
    frames = []
    durations = []
    disposals = []
    transparency_indices = []

    for frame in ImageSequence.Iterator(gif):
        ascii_frame = image_to_ascii(frame, new_width, ascii_chars)
        frames.append(ascii_frame)
        durations.append(frame.info.get('duration', 100))
        disposals.append(frame.info.get('disposal', 2))
        transparency_indices.append(frame.info.get('transparency', 255))

    frames[0].save(
        output_path,
        save_all=True,
        append_images=frames[1:],
        loop=0,
        duration=durations,
        disposal=disposals,
        transparency=transparency_indices[0]
    )


def process_image(input_path, output_path, new_width, ascii_chars):
    if input_path.lower().endswith('.gif'):
        output_path = os.path.splitext(output_path)[0] + "_ascii.gif"
        process_gif(input_path, output_path, new_width, ascii_chars)
        print(f"ASCII art GIF saved to {output_path}")
    else:
        ascii_image = image_to_ascii(Image.open(input_path).convert('RGBA'), new_width, ascii_chars)
        output_path = os.path.splitext(output_path)[0] + "_ascii.png"
        ascii_image.save(output_path)
        print(f"ASCII art image saved to {output_path}")


def process_directory(input_dir, output_dir, new_width, ascii_chars):
    for filename in os.listdir(input_dir):
        if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif')):
            input_path = os.path.join(input_dir, filename)
            output_path = os.path.join(output_dir, os.path.splitext(filename)[0])
            process_image(input_path, output_path, new_width, ascii_chars)


def main():
    if len(sys.argv) < 3:
        print("Usage: script.py <input file/directory> <output file/directory> [ascii_chars]")
        return

    input_path = sys.argv[1]
    output_path = sys.argv[2]
    new_width = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    ascii_chars = sys.argv[4] if len(sys.argv) > 4 else ".:-=+*#%@"
    

    start_time = time.time()

    if os.path.isdir(input_path):
        if not os.path.exists(output_path):
            os.makedirs(output_path)
        process_directory(input_path, output_path, new_width, ascii_chars)
    else:
        if os.path.isdir(output_path):
            output_file = os.path.join(output_path, os.path.basename(input_path))
        else:
            output_file = output_path
        process_image(input_path, output_file, new_width, ascii_chars)

    end_time = time.time()
    elapsed_time = end_time - start_time
    print(f"Elapsed time: {elapsed_time:.2f} seconds")


if __name__ == '__main__':
    main()
