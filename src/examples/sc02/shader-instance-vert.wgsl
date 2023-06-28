// vertex shader
@group(0) @binding(0) var<uniform> viewProjectMat: mat4x4f;
@group(0) @binding(1) var<storage> modelMat: array<mat4x4f>;
@group(0) @binding(2) var<storage> normalMat: array<mat4x4f>;
@group(0) @binding(3) var<storage> colorVec: array<vec4f>;

struct Input {
    @builtin(instance_index) idx: u32, 
    @location(0) position: vec3f, 
    @location(1) normal: vec3f
}

struct Output {
    @builtin(position) position: vec4f,
    @location(0) vPosition: vec4f,
    @location(1) vNormal: vec4f,
    @location(2) vColor: vec4f,
};

@vertex
fn vs_main(in:Input) -> Output {    
    var output: Output;     
    let modelMat = modelMat[in.idx];
    let normalMat = normalMat[in.idx];
    let mPosition:vec4<f32> = modelMat * vec4(in.position, 1.0); 
    output.vPosition = mPosition;                  
    output.vNormal =  normalMat * vec4(in.normal, 1.0);
    output.position = viewProjectMat * mPosition;  
    output.vColor = colorVec[in.idx];             
    return output;
}