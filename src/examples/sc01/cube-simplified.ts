import shader from './unlit-vertex-color.wgsl';
import * as ws from 'webgpu-simplified';
import { getCubeData } from '../../common/vertex-data';
import { vec3, mat4 } from 'gl-matrix';

const createPipeline = async (init: ws.IWebGPUInit, data: any): Promise<ws.IPipeline> => {
    const descriptor = ws.createRenderPipelineDescriptor({
        init,
        shader: shader,
        buffers: ws.setVertexBuffers(['float32x3', 'float32x3']), 
    });
    const pipeline = await init.device.createRenderPipelineAsync(descriptor);

    // create vertex buffers
    const positionBuffer = ws.createBufferWithData(init.device, data.positions);
    const colorBuffer = ws.createBufferWithData(init.device, data.colors);
    const indexBuffer = ws.createBufferWithData(init.device, data.indices);

    // create uniform buffer and bind group for pass mvp matrix
    const  uniformBuffer = ws.createBuffer(init.device, 64);
    const uniformBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(0), [uniformBuffer]);

    // create depth texture
    const depthTexture = ws.createDepthTexture(init);
    
    return {
        pipelines: [pipeline],
        vertexBuffers: [positionBuffer, colorBuffer, indexBuffer],
        uniformBuffers: [uniformBuffer],
        uniformBindGroups: [uniformBindGroup],
        depthTextures: [depthTexture],
    };
}

const draw = (init:ws.IWebGPUInit, p:ws.IPipeline, data:any) => {  
    const commandEncoder =  init.device.createCommandEncoder();
    const renderPass = commandEncoder.beginRenderPass(ws.createRenderPassDescriptor({
        init, depthView: p.depthTextures[0].createView(),
    }));
    
    renderPass.setPipeline(p.pipelines[0]);
    renderPass.setVertexBuffer(0, p.vertexBuffers[0]);
    renderPass.setVertexBuffer(1, p.vertexBuffers[1]);
    renderPass.setBindGroup(0, p.uniformBindGroups[0]);
    renderPass.setIndexBuffer(p.vertexBuffers[2], 'uint32');
    renderPass.drawIndexed(data.indices.length);
    renderPass.end();
    init.device.queue.submit([commandEncoder.finish()]);
}

const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const init = await ws.initWebGPU({canvas});
    const data = getCubeData();
    const p = await createPipeline(init, data);
    
    let modelMat = mat4.create();
    let vt = ws.createViewTransform();
    let viewMat = vt.viewMat;
    let projectMat = mat4.create();
    let mvpMat = mat4.create();
   
    let aspect = init.size.width / init.size.height;  
    let rotation = vec3.fromValues(0, 0, 0);    
    var camera = ws.getCamera(canvas, vt.cameraOptions);
 
    var gui = ws.getDatGui();
    const params = {
        rotationSpeed: 0.9,
    };    
    gui.add(params, 'rotationSpeed', 0, 5, 0.1);      

    var stats = ws.getStats();
    let start = performance.now();
    const frame = () => {     
        stats.begin();

        projectMat = ws.createProjectionMat(aspect);
        if(camera.tick()){
            viewMat = camera.matrix;
        }
        var dt = (performance.now() - start)/1000;             
        rotation[0] = Math.sin(dt * params.rotationSpeed);
        rotation[1] = Math.cos(dt * params.rotationSpeed); 
        modelMat = ws.createModelMat([0,0,0], rotation);
        mvpMat = ws.combineMvpMat(modelMat, viewMat, projectMat);
        init.device.queue.writeBuffer(p.uniformBuffers[0], 0, mvpMat as ArrayBuffer);  
        draw(init, p, data);   
        
        requestAnimationFrame(frame);
        stats.end();        
    };
    frame();
}

run();