import vert_shader from './shadow-vert.wgsl';
import depth_shader from './shadow-depth.wgsl';
import frag_shader from './shadow-frag.wgsl';
import * as ws from 'webgpu-simplified';
import { getCubeData, getTorusData } from '../../common/vertex-data';
import { vec3, mat4 } from 'gl-matrix';

const createPipeline = async (init:ws.IWebGPUInit, data: any, numObjects: number): Promise<ws.IPipeline> => {   
    // pipeline for shape
    const descriptor = ws.createRenderPipelineDescriptor({
        init,
        vsShader: vert_shader,
        fsShader:frag_shader,
        buffers: ws.setVertexBuffers(['float32x3', 'float32x3']),
    });
    const pipeline = await init.device.createRenderPipelineAsync(descriptor);
   
    // pipeline for shadow
    const descriptor2 = ws.createRenderPipelineDescriptor({
        init,
        vsShader: depth_shader,
        buffers: ws.setVertexBuffers(['float32x3', 'float32x3']),
    }, false);
    const shadowPipeline = await init.device.createRenderPipelineAsync(descriptor2);
    
    // create depth view
    const depthTexture = ws.createDepthTexture(init);
    
    // create depth texture for shadow
    const shadowDepthTexture = init.device.createTexture({
        size: [2048, 2048],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
      
    // create vertex and index buffers for cube
    const cubeData = data.cubeData;
    const vertexBuffer = ws.createBufferWithData(init.device, cubeData.positions);
    const normalBuffer = ws.createBufferWithData(init.device, cubeData.normals);
    const indexBuffer = ws.createBufferWithData(init.device, cubeData.indices);

    // create vertex and index buffers for torus
    const torusData = data.torusData;
    const vertexBuffer1 = ws.createBufferWithData(init.device, torusData.positions);
    const normalBuffer1 = ws.createBufferWithData(init.device, torusData.normals);
    const indexBuffer1 = ws.createBufferWithData(init.device, torusData.indices);

    // uniform buffer for transform matrix
    const vpUniformBuffer = ws.createBuffer(init.device, 64);
    const modelUniformBuffer = ws.createBuffer(init.device, 64 * numObjects, ws.BufferType.Storage);
    const normalUniformBuffer = ws.createBuffer(init.device, 64 * numObjects, ws.BufferType.Storage);
    const colorUniformBuffer = ws.createBuffer(init.device, 16 * numObjects, ws.BufferType.Storage);

    // uniform buffer for light projection
    const lightProjectUniformBuffer = ws.createBuffer(init.device, 64);

    // uniform buffer for light 
    const lightUniformBuffer = ws.createBuffer(init.device, 48);
   
    // uniform buffer for material
    const materialUniformBuffer = ws.createBuffer(init.device, 16); 
   
    // uniform bind group for vertex shader
    const vertBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(0), 
        [vpUniformBuffer, modelUniformBuffer, normalUniformBuffer, 
         lightProjectUniformBuffer, colorUniformBuffer]);

    // uniform bind group for fragment shader
    const fragBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(1), 
        [lightUniformBuffer, materialUniformBuffer], 
        [shadowDepthTexture.createView(), init.device.createSampler({
            compare: 'less',
        })]);
    
    // uniform bind group for shadow
    const shadowBindGroup = ws.createBindGroup(init.device, shadowPipeline.getBindGroupLayout(0), 
        [modelUniformBuffer, lightProjectUniformBuffer]);
    
    return {
        pipelines: [pipeline, shadowPipeline],
        vertexBuffers: [
            vertexBuffer, normalBuffer, indexBuffer,    // for cube
            vertexBuffer1, normalBuffer1, indexBuffer1, // for sphere 
        ],
        uniformBuffers: [
            vpUniformBuffer,
            modelUniformBuffer,
            normalUniformBuffer,
            lightProjectUniformBuffer,
            colorUniformBuffer,
            lightUniformBuffer,
            materialUniformBuffer      
        ],
        uniformBindGroups: [vertBindGroup, fragBindGroup, shadowBindGroup],
        depthTextures: [depthTexture, shadowDepthTexture], 
    };
}

const draw = (init:ws.IWebGPUInit, p:ws.IPipeline, data:any, numObjects:number) => {  
    const commandEncoder =  init.device.createCommandEncoder();

    // draw shadow
    {
        const descriptor = ws.createRenderPassDescriptor({
            init, depthView: p.depthTextures[1].createView()}, false);
        const shadowPass = commandEncoder.beginRenderPass(descriptor);
        
        shadowPass.setPipeline(p.pipelines[1]);
        shadowPass.setBindGroup(0, p.uniformBindGroups[2]);

        // draw cubes
        shadowPass.setVertexBuffer(0, p.vertexBuffers[0]);
        shadowPass.setVertexBuffer(1, p.vertexBuffers[1]);
        shadowPass.setIndexBuffer(p.vertexBuffers[2], 'uint32');
        shadowPass.drawIndexed(data.cubeData.indices.length, 1, 0, 0, 0);

        // draw torus
        shadowPass.setVertexBuffer(0, p.vertexBuffers[3]);
        shadowPass.setVertexBuffer(1, p.vertexBuffers[4]);
        shadowPass.setIndexBuffer(p.vertexBuffers[5], 'uint32');
        shadowPass.drawIndexed(data.torusData.indices.length, 1, 0, 0, 1);
       
        shadowPass.end();
    }
   
    // render objects:
    {
        const descriptor = ws.createRenderPassDescriptor({
            init, depthView: p.depthTextures[0].createView()});
        const renderPass = commandEncoder.beginRenderPass(descriptor);

        renderPass.setPipeline(p.pipelines[0]);
        renderPass.setBindGroup(0, p.uniformBindGroups[0]);
        renderPass.setBindGroup(1, p.uniformBindGroups[1]);

        // draw cubes
        renderPass.setVertexBuffer(0, p.vertexBuffers[0]);
        renderPass.setVertexBuffer(1, p.vertexBuffers[1]);
        renderPass.setIndexBuffer(p.vertexBuffers[2], 'uint32');
        renderPass.drawIndexed(data.cubeData.indices.length, 1, 0, 0, 0);

        // draw torus
        renderPass.setVertexBuffer(0, p.vertexBuffers[3]);
        renderPass.setVertexBuffer(1, p.vertexBuffers[4]);
        renderPass.setIndexBuffer(p.vertexBuffers[5], 'uint32');
        renderPass.drawIndexed(data.torusData.indices.length, 1, 0, 0, 1); 

        renderPass.end();
    }
    init.device.queue.submit([commandEncoder.finish()]);
}

export const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const init = await ws.initWebGPU({canvas});

    let numObjects = 2;
    const cubeData = getCubeData();
    const torusData = getTorusData(1.5, 0.45, 60, 20);
    const data = {cubeData, torusData};

    const p = await createPipeline(init, data, numObjects);
  
    let vt = ws.createViewTransform([0,10,20]);
    let viewMat = vt.viewMat;

    let aspect = init.size.width / init.size.height;      
    let projectMat = ws.createProjectionMat(aspect);
    let vpMat = ws.combineVpMat(viewMat, projectMat);

    init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);
    let eyePosition = new Float32Array(vt.cameraOptions.eye);
    init.device.queue.writeBuffer(p.uniformBuffers[5], 16, eyePosition as Float32Array);

    var gui = ws.getDatGui();
    document.querySelector('#gui').append(gui.domElement);
    const params = {
        animateSpeed: 1,
        specularColor: '#ffffff',
        ambient: 0.4,
        diffuse: 0.04,
        specular: 0.4,
        shininess: 30,
    };
     
    gui.add(params, 'animateSpeed', 0, 5, 0.01);  
    gui.addColor(params, 'specularColor');

    var folder = gui.addFolder('Set lighting parameters');
    folder.open();
    folder.add(params, 'ambient', 0, 1, 0.02);  
    folder.add(params, 'diffuse', 0, 1, 0.02);  
    folder.add(params, 'specular', 0, 1, 0.02);  
    folder.add(params, 'shininess', 0, 300, 1);  

    const scene: any[] = [];  
    const mMat = new Float32Array(16* numObjects);
    const nMat = new Float32Array(16* numObjects);
    const cVec = new Float32Array(4 * numObjects);
   
    // add a cube as floor
    {
        let translation = vec3.fromValues(0, -13, -20);
        const rotation = vec3.fromValues(0, 0, 0);
        const scale = vec3.fromValues(30, 0.1, 20);
        let m = ws.createModelMat(translation, rotation, scale);
        let n = ws.createNormalMat(m);
        mMat.set(m, 0);
        nMat.set(n, 0);
        cVec.set([0.5, 0.5, 0.7, 1], 0);
        scene.push({translation, rotation, scale});
    }   

    // add a torus     
    let translation = vec3.fromValues(0, -5, -20);
    let rotation = vec3.fromValues(Math.PI/2, 0, 0);
    let scale = vec3.fromValues(4, 4, 4);
    let m = ws.createModelMat(translation, rotation, scale);
    let n = ws.createNormalMat(m);
    mMat.set(m, 16);
    nMat.set(n, 16);
    cVec.set([Math.random(), Math.random(), Math.random()], 4);
    scene.push({translation, rotation, scale }); 
    init.device.queue.writeBuffer(p.uniformBuffers[4], 0, cVec);
      
    const lightMat = mat4.create();
    const lightProjectMat = mat4.create();
    const lightPosition = vec3.fromValues(0, 100, 0);

    let stats = ws.getStats();
    let start = performance.now();
    let h0 = 0.1;
    let v0 = 0.2;
    const frame = () => {     
        stats.begin();
        let dt = params.animateSpeed * (performance.now() - start)/1000;
        lightPosition[0] = 50 * Math.sin(dt);
        lightPosition[2] = 50 * Math.cos(dt);

        // update uniform buffers for light position and colors
        init.device.queue.writeBuffer(p.uniformBuffers[5], 0, lightPosition as Float32Array);
        init.device.queue.writeBuffer(p.uniformBuffers[5], 32, ws.hex2rgb(params.specularColor));

        // update uniform buffer for material
        init.device.queue.writeBuffer(p.uniformBuffers[6], 0, new Float32Array([
            params.ambient, params.diffuse, params.specular, params.shininess
        ]));
        
        mat4.lookAt(lightMat, lightPosition, [0,0,0], [0,1,0]);
        mat4.ortho(lightProjectMat, -40, 40, -40, 40, -50, 200);
        mat4.multiply(lightProjectMat, lightProjectMat, lightMat);
        init.device.queue.writeBuffer(p.uniformBuffers[3], 0, lightProjectMat as Float32Array);
        
        // update torus position:
        const torus = scene[1];
        torus.rotation[2] = 2*dt;
        torus.translation[0] += h0;
        torus.translation[2] -= h0;
        torus.translation[1] += v0;
        if(torus.translation[0] < -20 || torus.translation[0] > 20) {
            h0 *= -1;
        }
        if(torus.translation[1] < -5 || torus.translation[1] > 8) {
            v0 *= -1;
        }

        let m = ws.createModelMat(torus.translation, torus.rotation, torus.scale);
        let n = ws.createNormalMat(m);
        mMat.set(m, 16);
        nMat.set(n, 16);

        // update uniform buffers for transformation 
        init.device.queue.writeBuffer(p.uniformBuffers[1], 0, mMat);  
        init.device.queue.writeBuffer(p.uniformBuffers[2], 0, nMat);     

        draw(init, p, data, numObjects);   

        requestAnimationFrame(frame);
        stats.end();
    };
    frame();
}

run();