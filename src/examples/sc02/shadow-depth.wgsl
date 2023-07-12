@group(0) @binding(0) var<storage> modelMat: array<mat4x4f>;
@group(0) @binding(1) var<uniform> lightProjectMat: mat4x4f;

struct Input {
    @builtin(instance_index) idx : u32,
    @location(0) position : vec4f,
    @location(1) normal: vec4f,
};

@vertex
fn vs_main(in:Input) -> @builtin(position) vec4f {
    let mPosition = modelMat[in.idx] * in.position;
    return lightProjectMat * mPosition;
}