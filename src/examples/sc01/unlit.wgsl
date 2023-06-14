@binding(0) @group(0) var<uniform> mvpMatrix: mat4x4f;

@vertex
fn vs_main(@location(0) pos: vec4f) -> @builtin(position) vec4f {
    return mvpMatrix * pos;
}

@binding(1) @group(0) var<uniform> color: vec4f;

@fragment
fn fs_main() -> @location(0) vec4f {
    return color;
}