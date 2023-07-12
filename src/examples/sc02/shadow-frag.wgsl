struct LightUniforms {
    lightPosition: vec4f,
    eyePosition: vec4f,
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
@group(1) @binding(2) var shadowTexture: texture_depth_2d;
@group(1) @binding(3) var shadowSampler: sampler_comparison;

struct Input {
    @location(0) vPosition: vec4f,
    @location(1) vNormal: vec4f,
    @location(2) vShadowPos: vec4f,
    @location(3) vColor: vec4f,
};

fn blinnPhong(N:vec3f, L:vec3f, V:vec3f) -> vec2f {
    let H = normalize(L + V);
    var diffuse = material.diffuse * max(dot(N, L), 0.0);
    diffuse += material.diffuse * max(dot(-N, L), 0.0);
    var specular = material.specular * pow(max(dot(N, H), 0.0), material.shininess);
    specular += material.specular * pow(max(dot(-N, H),0.0), material.shininess);
    return vec2(diffuse, specular);
}

@fragment
fn fs_main(in:Input) ->  @location(0) vec4f {
    var N = normalize(in.vNormal.xyz);                
    let L = normalize(light.lightPosition.xyz - in.vPosition.xyz);     
    let V = normalize(light.eyePosition.xyz - in.vPosition.xyz);          
   
    let bp = blinnPhong(N, L, V);

    var visibility = 0.0;
    let size = f32(textureDimensions(shadowTexture).x);
    let oneOverSize = 1.0/size;
    for (var y: i32 = -1 ; y <= 1 ; y = y + 1) {
        for (var x: i32 = -1 ; x <= 1 ; x = x + 1) {
            let offset = vec2(f32(x)*oneOverSize, f32(y)*oneOverSize);
            visibility += textureSampleCompare(
                shadowTexture, 
                shadowSampler,
                in.vShadowPos.xy + offset, 
                in.vShadowPos.z - 0.007 
            );
        }
    }
    visibility /= 0.9;       
    let finalColor = in.vColor * (material.ambient + visibility * bp[0]) + light.specularColor * bp[1]; 
    return vec4(finalColor.rgb, 1.0);
}