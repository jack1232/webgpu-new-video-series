@binding(0) @group(0) var<uniform> mvpMatrix : mat4x4f;

struct Output {
    @builtin(position) Position : vec4f,
    @location(0) vColor : vec4f,
};

@vertex
fn vs_main(@location(0) pos: vec3f, @location(1) color: vec3f) -> Output {
    var output: Output;
    output.Position = mvpMatrix * vec4(pos, 1.0);
    output.vColor = vec4(color, 1.0);
    return output;
}

@fragment
fn fs_main(@location(0) vColor: vec4f) -> @location(0) vec4f {
    return vColor;
}