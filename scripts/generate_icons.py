import os

from PIL import Image, ImageDraw


def create_app_icons():
    os.makedirs("src-tauri/icons", exist_ok=True)

    # Create base 512x512 icon
    size = 512
    img = Image.new("RGBA", (size, size), (9, 10, 15, 255))
    draw = ImageDraw.Draw(img)

    # Draw dark rounded rectangle background
    draw.rounded_rectangle(
        [32, 32, size - 32, size - 32],
        radius=96,
        fill=(18, 19, 26, 255),
        outline=(225, 29, 72, 255),
        width=8,
    )

    # Draw stylish Play / "A" triangle in ruby red
    points = [(180, 140), (380, 256), (180, 372)]
    draw.polygon(points, fill=(225, 29, 72, 255))

    # Save standard sizes
    img.save("src-tauri/icons/icon.png", "PNG")
    img.resize((32, 32), Image.Resampling.LANCZOS).save(
        "src-tauri/icons/32x32.png", "PNG"
    )
    img.resize((128, 128), Image.Resampling.LANCZOS).save(
        "src-tauri/icons/128x128.png", "PNG"
    )
    img.resize((256, 256), Image.Resampling.LANCZOS).save(
        "src-tauri/icons/128x128@2x.png", "PNG"
    )

    # Save ICO with multiple resolutions
    img.save(
        "src-tauri/icons/icon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print("Created src-tauri/icons/ with icon.ico and PNGs!")


if __name__ == "__main__":
    create_app_icons()
