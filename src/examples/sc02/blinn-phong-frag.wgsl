// fragment shader
struct LightUniforms {
    lightPosition: vec4f,
    eyePosition: vec4f,
    color: vec4f,  
    specularColor: vec4f,
};
@group(1) @binding(0) var<uniform> light : LightUniforms;

struct MaterialUniforms {
    ambient: f32,
    diffuse: f32,
    specular: f32,
    shininess: f32,
};
@group(1) @binding(1) var<uniform> material : MaterialUniforms;

fn blinnPhong(N:vec3f, L:vec3f, V:vec3f) -> vec2f{
    let H = normalize(L + V);
    var diffuse = material.diffuse * max(dot(N, L), 0.0);
    var specular = material.specular * pow(max(dot(N, H), 0.0), material.shininess);
    return vec2(diffuse, specular);
}

@fragment
fn fs_main(@location(0) vPosition:vec4f, @location(1) vNormal:vec4f) ->  @location(0) vec4f {
    var N = normalize(vNormal.xyz);                
    let L = normalize(light.lightPosition.xyz - vPosition.xyz);     
    let V = normalize(light.eyePosition.xyz - vPosition.xyz);          
   
    let bp = blinnPhong(N, L, V);
           
    let finalColor = light.color*(material.ambient + bp[0]) + light.specularColor * bp[1]; 
    return vec4(finalColor.rgb, 1.0);
}