import { vec3 } from 'gl-matrix';
const pi = 3.1415926;

const sin = (x:number) => Math.sin(x);
const cos = (x:number) => Math.cos(x);

const getSpherePosition = (radius:number, theta:number, phi:number): vec3 => {
    let x = radius * sin(theta) * cos(phi);
    let y = radius * cos(theta);
    let z = -radius * sin(theta) * sin(phi);    
    return vec3.fromValues(x, y, z);     
}

export const getSphereData = (radius:number, u:number, v:number) => {
    if(u < 2 || v < 2) return;
    let pts = [], normals = [], uvs = [];
    for(let i = 0; i <= u; i++){
        for(let j = 0; j <= v; j++){
            let pt = getSpherePosition(radius, i*pi/u, j*2*pi/v);
            pts.push(pt[0], pt[1], pt[2]);
            normals.push(pt[0]/radius, pt[1]/radius, pt[2]/radius);
            uvs.push(i/u, j/v);
        }
    }

    let vertices_per_row = v + 1;
    let indices = [];
    let indices2 = [];

    for(let i = 0; i < u; i++){
        for(let j = 0; j < v; j++) {
            let idx0 = j + i * vertices_per_row;
            let idx1 = j + 1 + i * vertices_per_row;
            let idx2 = j + 1 + (i + 1) * vertices_per_row;
            let idx3 = j + (i + 1) * vertices_per_row; 

            indices.push(idx0, idx1, idx2, idx2, idx3, idx0);          
            indices2.push(idx0, idx1, idx0, idx3);      
        }
    }
    return {
        positions: new Float32Array(pts),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indices: new Uint32Array(indices),
        indices2: new Uint32Array(indices2),
    };
}

export const getCubeData = (side = 2, uLength = 1, vLength = 1) => {
    let s2 = side / 2;
    let positions = new Float32Array([
        s2,  s2,  s2,   // index 0
        s2,  s2, -s2,   // index 1
        s2, -s2,  s2,   // index 2
        s2, -s2, -s2,   // index 3
       -s2,  s2, -s2,   // index 4
       -s2,  s2,  s2,   // index 5
       -s2, -s2, -s2,   // index 6
       -s2, -s2,  s2,   // index 7
       -s2,  s2, -s2,   // index 8
        s2,  s2, -s2,   // index 9
       -s2,  s2,  s2,   // index 10
        s2,  s2,  s2,   // index 11
       -s2, -s2,  s2,   // index 12
        s2, -s2,  s2,   // index 13
       -s2, -s2, -s2,   // index 14
        s2, -s2, -s2,   // index 15
       -s2,  s2,  s2,   // index 16
        s2,  s2,  s2,   // index 17
       -s2, -s2,  s2,   // index 18
        s2, -s2,  s2,   // index 19
        s2,  s2, -s2,   // index 20
       -s2,  s2, -s2,   // index 21
        s2, -s2, -s2,   // index 22
       -s2, -s2, -s2,   // index 23
    ]); 

    let colors = new Float32Array([
        1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0,
        0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1,
        0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1,
        0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0,
        0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1,
        1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0
    ]);

    let normals = new Float32Array([
        1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,
       -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0,
        0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,  0,
        0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,  0,
        0,  0,  1,  0,  0,  1,  0,  0,  1,  0,  0,  1,
        0,  0, -1,  0,  0, -1,  0,  0, -1,  0,  0, -1,
    ]);

    let u = uLength;
    let v = vLength;
    let uvs = new Float32Array([
        0, v, u, v, 0, 0, u, 0, 0, v, u, v, 0, 0, u, 0, 
        0, v, u, v, 0, 0, u, 0, 0, v, u, v, 0, 0, u, 0, 
        0, v, u, v, 0, 0, u, 0, 0, v, u, v, 0, 0, u, 0, 
    ]);

    let indices = new Uint32Array([     // triangle indices
         0,  2,  1,
         2,  3,  1,
         4,  6,  5,
         6,  7,  5,
         8, 10,  9,
        10, 11,  9,
        12, 14, 13,
        14, 15, 13,
        16, 18, 17,
        18, 19, 17,
        20, 22, 21,
        22, 23, 21,
    ]);

    let indices2 = new Uint32Array([    // wireframe indices
        8, 9, 9, 11, 11, 10, 10, 8,     // top
        14, 15, 15, 13, 13, 12, 12, 14, // bottom
        11, 13, 9, 15, 8, 14, 10, 12,   // side
    ])
    
    return {positions, colors, normals, uvs, indices, indices2};
}