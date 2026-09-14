import os


def test_project_structure():
    assert os.path.exists("src-tauri/Cargo.toml"), "src-tauri/Cargo.toml missing"
    assert os.path.exists("src-tauri/tauri.conf.json"), (
        "src-tauri/tauri.conf.json missing"
    )
    assert os.path.exists("src-tauri/capabilities/default.json"), (
        "src-tauri/capabilities/default.json missing"
    )
    assert os.path.exists("src-tauri/src/lib.rs"), "src-tauri/src/lib.rs missing"
    assert os.path.exists("package.json"), "package.json missing"
    assert os.path.exists("shaders/anime4k/Anime4K_Clamp_Highlights.glsl"), (
        "shaders missing"
    )
    assert os.path.exists("bin/mpv-dev/libmpv-2.dll"), "libmpv-2.dll missing"
    print("Project structure verified successfully!")


if __name__ == "__main__":
    test_project_structure()
