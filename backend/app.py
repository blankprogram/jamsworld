from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from PIL import Image, ImageFont
from ascii import AsciiArtConverter

app = Flask(__name__)
CORS(app)

app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['OUTPUT_FOLDER'] = 'output'
app.config['FONT_FOLDER'] = 'fonts'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['OUTPUT_FOLDER'], exist_ok=True)
os.makedirs(app.config['FONT_FOLDER'], exist_ok=True)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    input_path = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(input_path)

    width = int(request.form.get('width', 100))
    chars = request.form.get('chars', ".:-=+*#%@")
    font_path = request.form.get('font', None)
    fill = request.form.get('fill', None) or None

    if fill == 'transparent':
        fill = None

    font = ImageFont.truetype(font_path, 10) if font_path else ImageFont.load_default()

    output_extension = '.gif' if input_path.lower().endswith('.gif') else '.png'
    output_filename = f"{os.path.splitext(file.filename)[0]}{output_extension}"
    output_path = os.path.join(app.config['OUTPUT_FOLDER'], output_filename)

    converter = AsciiArtConverter(width, chars, font, fill)
    converter.process_image(input_path, output_path)

    final_output_filename = f"{os.path.splitext(file.filename)[0]}_ascii{output_extension}"
    final_output_path = os.path.join(app.config['OUTPUT_FOLDER'], final_output_filename)

    if not os.path.exists(final_output_path):
        return jsonify({'error': 'File processing error'}), 500

    return jsonify({'output_path': final_output_filename}), 200

@app.route('/output/<filename>')
def send_output(filename):
    return send_from_directory(app.config['OUTPUT_FOLDER'], filename)

@app.route('/fonts', methods=['GET'])
def get_fonts():
    fonts = [{'name': os.path.splitext(filename)[0], 'path': os.path.join(app.config['FONT_FOLDER'], filename)}
             for filename in os.listdir(app.config['FONT_FOLDER']) if filename.lower().endswith('.ttf')]
    return jsonify(fonts), 200

if __name__ == "__main__":
    app.run(debug=True)
