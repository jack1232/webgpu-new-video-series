import vert_shader from './shader-instance-vert.wgsl';
import frag_shader from './spot-frag.wgsl';
import * as ws from  'webgpu-simplified';
import { vec3, mat4 } from 'gl-matrix';
import { getCubeData, getSphereData } from '../../common/vertex-data';

const createPipeline = async (init:ws.IWebGPUInit, data:any, numObjects:number): Promise<ws.IPipeline> => {   
    const descriptor = ws.createRenderPipelineDescriptor({
        init,
        vsShader: vert_shader,
        fsShader: frag_shader,  
        buffers: ws.setVertexBuffers(['float32x3', 'float32x3']),
    });
    const pipeline = await init.device.createRenderPipelineAsync(descriptor);
    
    // create vertex and index buffers for cube
    const cubeData = data.cubeData;
    const vertexBuffer = ws.createBufferWithData(init.device, cubeData.positions);
    const normalBuffer = ws.createBufferWithData(init.device, cubeData.normals);
    const indexBuffer = ws.createBufferWithData(init.device, cubeData.indices);

    // create vertex and index buffers for sphere
    const sphereData = data.sphereData;
    const vertexBuffer1 = ws.createBufferWithData(init.device, sphereData.positions);
    const normalBuffer1 = ws.createBufferWithData(init.device, sphereData.normals);
    const indexBuffer1 = ws.createBufferWithData(init.device, sphereData.indices);

    // uniform and storage buffers for transform matrix
    const vpUniformBuffer = ws.createBuffer(init.device, 64);
    const modelUniformBuffer = ws.createBuffer(init.device, 64 * numObjects, ws.BufferType.Storage);
    const normalUniformBuffer = ws.createBuffer(init.device, 64 * numObjects, ws.BufferType.Storage);
    const colorUniformBuffer = ws.createBuffer(init.device, 16 * numObjects, ws.BufferType.Storage);

    // uniform buffer for light 
    const lightUniformBuffer = ws.createBuffer(init.device, 64);

    // uniform buffer for material
    const materialUniformBuffer = ws.createBuffer(init.device, 32);   

    // uniform bind group for vertex shader
    const vertBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(0), 
        [vpUniformBuffer, modelUniformBuffer, normalUniformBuffer, colorUniformBuffer]);

    // uniform bind group for fragment shader
    const fragBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(1), 
        [lightUniformBuffer, materialUniformBuffer]);

    // create depth view
    const depthTexture = ws.createDepthTexture(init);

    // create texture view for MASS (count = 4)
    const msaaTexture = ws.createMultiSampleTexture(init);

    return {
        pipelines: [pipeline],
        vertexBuffers: [
            vertexBuffer, normalBuffer, indexBuffer,        // cube
            vertexBuffer1, normalBuffer1, indexBuffer1,     // sphere
        ],
        uniformBuffers: [
            vpUniformBuffer,        // for vertex
            modelUniformBuffer, 
            normalUniformBuffer, 
            colorUniformBuffer, 
            lightUniformBuffer,     // for fragmnet
            materialUniformBuffer      
        ],
        uniformBindGroups: [vertBindGroup, fragBindGroup],
        gpuTextures: [msaaTexture],
        depthTextures: [depthTexture],    
    };
}

const draw = (init:ws.IWebGPUInit, p:ws.IPipeline, data:any, numShapes:any) => {  
    const commandEncoder =  init.device.createCommandEncoder();   
    const descriptor = ws.createRenderPassDescriptor({
        init,
        depthView: p.depthTextures[0].createView(),
        textureView: p.gpuTextures[0].createView(),
    });
    const renderPass = commandEncoder.beginRenderPass(descriptor);

    renderPass.setPipeline(p.pipelines[0]);
    renderPass.setBindGroup(0, p.uniformBindGroups[0]);
    renderPass.setBindGroup(1, p.uniformBindGroups[1]);

    // draw cubes
    renderPass.setVertexBuffer(0, p.vertexBuffers[0]);
    renderPass.setVertexBuffer(1, p.vertexBuffers[1]);
    renderPass.setIndexBuffer(p.vertexBuffers[2], 'uint32');
    renderPass.drawIndexed(data.cubeData.indices.length, numShapes.cube, 0, 0, 0);

    // draw spheres
    renderPass.setVertexBuffer(0, p.vertexBuffers[3]);
    renderPass.setVertexBuffer(1, p.vertexBuffers[4]);
    renderPass.setIndexBuffer(p.vertexBuffers[5], 'uint32');
    renderPass.drawIndexed(data.sphereData.indices.length, numShapes.sphere, 0, 0, numShapes.cube);

    renderPass.end();
    init.device.queue.submit([commandEncoder.finish()]);
}

const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const init = await ws.initWebGPU({canvas, msaaCount: 4});

    const NUM_CUBES = 100;
    const NUM_SPHERES = 100;
    const numObjects = NUM_CUBES + NUM_SPHERES;
    const cubeData = getCubeData();
    const sphereData = getSphereData(1.5, 20, 32);
    const data = { cubeData, sphereData };

    const p = await createPipeline(init, data, numObjects);

    let vt = ws.createViewTransform([4,4,8]);
    let viewMat = vt.viewMat;

    let aspect = init.size.width / init.size.height;      
    let projectMat = ws.createProjectionMat(aspect);
    let vpMat = ws.combineVpMat(viewMat, projectMat);
    init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);

    var camera = ws.getCamera(canvas, vt.cameraOptions);
    let eyePosition = new Float32Array(vt.cameraOptions.eye);
    let lightDirection = new Float32Array([-2, -2, -4]);
    let lightPosition = eyePosition;
    
    // write light parameters to buffer 
    init.device.queue.writeBuffer(p.uniformBuffers[4], 0, lightPosition);
    init.device.queue.writeBuffer(p.uniformBuffers[4], 16, lightDirection);
    init.device.queue.writeBuffer(p.uniformBuffers[4], 32, eyePosition);


    var gui = ws.getDatGui();
    document.querySelector('#gui').append(gui.domElement);
    const params = {
        animateSpeed: 1,
        specularColor: '#ffffff',
        ambient: 0.1,
        diffuse: 0.7,
        specular: 0.4,
        shininess: 30,
        linear: 0.3,
        quadratic: 0.3,
        cutoff: 15,
    };
    
    gui.add(params, 'animateSpeed', 0, 5, 0.01);      
    var folder = gui.addFolder('Set lighting parameters');
    folder.open();
    folder.addColor(params, 'specularColor');
    folder.add(params, 'ambient', 0, 1, 0.02);  
    folder.add(params, 'diffuse', 0, 1, 0.02);  
    folder.add(params, 'specular', 0, 1, 0.02);  
    folder.add(params, 'shininess', 0, 300, 1);  

    folder = gui.addFolder('Set Point-light attenuation');
    folder.open();
    folder.add(params, 'linear', 0, 2, 0.02);  
    folder.add(params, 'quadratic', 0, 3, 0.03);  
    folder.add(params, 'cutoff', 0, 90, 0.5);

    const mMat = new Float32Array(16 * numObjects);
    const nMat = new Float32Array(16 * numObjects);
    const cVec = new Float32Array(4 * numObjects);

    for( let i = 0; i < numObjects; i++){
        let translation = vec3.fromValues(Math.random() * 35 - 35, Math.random() * 35 - 32, -15 - Math.random() * 50);
        let rotation = vec3.fromValues(Math.random(), Math.random(), Math.random());
        let scale = vec3.fromValues(1, 1, 1);
        let m = ws.createModelMat(translation, rotation, scale);
        let n = ws.createNormalMat(m);
        mMat.set(m, 16*i);
        nMat.set(n, 16*i);
        cVec.set([Math.random(), Math.random(), Math.random()], 4*i);
    }
    init.device.queue.writeBuffer(p.uniformBuffers[3], 0, cVec);

    let stats = ws.getStats();
    let start = performance.now();
    const frame = () => {     
        stats.begin();

        projectMat = ws.createProjectionMat(aspect);
        if(camera.tick()){
            viewMat = camera.matrix;
            vpMat = ws.combineVpMat(viewMat, projectMat);
            eyePosition = new Float32Array(camera.eye.flat());
            init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);
            init.device.queue.writeBuffer(p.uniformBuffers[4], 0, eyePosition);
            init.device.queue.writeBuffer(p.uniformBuffers[4], 32, eyePosition);
        }
       
        // update uniform buffers for transformation 
        init.device.queue.writeBuffer(p.uniformBuffers[1], 0, mMat);  
        init.device.queue.writeBuffer(p.uniformBuffers[2], 0, nMat);  

        // update uniform buffers for light direction and colors
        let dt = (performance.now() - start)/1000;
        let sn = 8 * Math.sin(params.animateSpeed*dt);
        let cn = 8 * Math.cos(params.animateSpeed*dt);        
        init.device.queue.writeBuffer(p.uniformBuffers[4], 0, Float32Array.of(sn, cn, 1));
        init.device.queue.writeBuffer(p.uniformBuffers[4], 48, ws.hex2rgb(params.specularColor));

        // update material uniform buffer
        init.device.queue.writeBuffer(p.uniformBuffers[5], 0, Float32Array.of(
            params.ambient, params.diffuse, params.specular, params.shininess, 1.0, params.linear, params.quadratic, params.cutoff
        ));

        const numShapes = {
            cube: NUM_CUBES,
            sphere: NUM_SPHERES,
        }
        draw(init, p, data, numShapes);   
        
        requestAnimationFrame(frame);
        stats.end();
    };
    frame();
}

run();