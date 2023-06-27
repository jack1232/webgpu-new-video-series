// vertex shader
struct Uniforms {   
    viewProjectMat : mat4x4f,
    modelMat : mat4x4f,           
    normalMat : mat4x4f,            
};
@binding(0) @group(0) var<uniform> uniforms : Uniforms;

struct Output {
    @builtin(position) position : vec4f,
    @location(0) vPosition : vec4f,
    @location(1) vNormal : vec4f,
};

@vertex
fn vs_main(@location(0) pos: vec3f, @location(1) normal: vec3f) -> Output {    
    var output: Output;            
    let mPosition = uniforms.modelMat * vec4(pos, 1.0); 
    output.vPosition = mPosition;                  
    output.vNormal =  uniforms.normalMat * vec4(normal, 1.0);
    output.position = uniforms.viewProjectMat * mPosition;               
    return output;
}