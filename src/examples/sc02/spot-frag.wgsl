const pi = 3.14159265358979323846;

struct LightUniforms {
    lightPosition : vec4f,
    lightDirection: vec4f,
    eyePosition : vec4f, 
    specularColor : vec4f,
}
@group(1) @binding(0) var<uniform> light : LightUniforms;

struct MaterialUniforms {
    // blinn-phong
    ambient: f32,
    diffuse: f32,
    specular: f32,
    shininess: f32,
    // spot light
    attConstant: f32,
    attLinear: f32,
    attQuadratic: f32,
    cutoff: f32,
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
    diffuse += material.diffuse * max(dot(-N, L), 0.0);
    var specular = material.specular * pow(max(dot(N, H), 0.0), material.shininess);
    specular += material.specular * pow(max(dot(-N, H),0.0), material.shininess);
    return vec2(diffuse, specular);
}

@fragment
fn fs_main(in:Input) ->  @location(0) vec4f {                  
    let L = normalize(light.lightPosition.xyz - in.vPosition.xyz);     
    let theta = dot(L, normalize(-light.lightDirection.xyz));      

    if(theta > cos(material.cutoff *pi/180)){
        var N = normalize(in.vNormal.xyz);  
        let V = normalize(light.eyePosition.xyz - in.vPosition.xyz);   
        let bp = blinnPhong(N, L, V);

        let distance = length(L);
        let att = 1.0 / (material.attConstant + material.attLinear * distance + material.attQuadratic * distance * distance);
            
        let finalColor = (in.vColor*(material.ambient + bp[0]) + light.specularColor * bp[1]) * att; 
        return vec4(finalColor.rgb, 1.0);
    } else {
        let finalColor = in.vColor*(material.ambient); 
        return vec4<f32>(finalColor.rgb, 1.0);
    }
}