struct LightUniforms {
    lightPosition : vec4f,
    eyePosition : vec4f,  
    specularColor : vec4f,
};
@group(1) @binding(0) var<uniform> light : LightUniforms;

struct MaterialUniforms {
    // blinn-phong
    ambient: f32,
    diffuse: f32,
    specular: f32,
    shininess: f32,

    // attenuation for point light
    attConstant: f32,
    attLinear: f32,
    attQuadratic: f32,
}
@group(1) @binding(1) var<uniform> material : MaterialUniforms;

struct Input {
    @location(0) vPosition:vec4f, 
    @location(1) vNormal:vec4f, 
    @location(2) vColor:vec4f,
}

fn blinnPhong(N:vec3f, L:vec3f, V:vec3f) -> vec2f{
    let H = normalize(L + V);
    var diffuse = material.diffuse * max(dot(N, L), 0.0);
    var specular = material.specular * pow(max(dot(N, H), 0.0), material.shininess);
    return vec2(diffuse, specular);
}

@fragment
fn fs_main(in:Input) ->  @location(0) vec4f {
    var N = normalize(in.vNormal.xyz);                
    let L = normalize(light.lightPosition.xyz - in.vPosition.xyz);     
    let V = normalize(light.eyePosition.xyz - in.vPosition.xyz);          
    
    let distance = length(L);
    let att = 1.0 / (material.attConstant + material.attLinear * distance + material.attQuadratic * distance * distance);

    let bp = blinnPhong(N, L, V);
   
    let finalColor = (in.vColor*(material.ambient + bp[0]) + light.specularColor * bp[1]) * att; 
    return vec4<f32>(finalColor.rgb, 1.0);
}