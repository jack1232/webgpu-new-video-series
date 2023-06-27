import vert_shader from './shader-vert.wgsl';
import frag_shader from './blinn-phong-frag.wgsl';
import * as ws from  'webgpu-simplified';
import { vec3, mat4 } from 'gl-matrix';
import { getSphereData } from '../../common/vertex-data';

export const createPipeline = async (init: ws.IWebGPUInit, data: any): Promise<ws.IPipeline> => {
    // pipeline for shape
    const descriptor = ws.createRenderPipelineDescriptor({
        init,
        vsShader: vert_shader,
        fsShader: frag_shader,
        buffers: ws.setVertexBuffers(['float32x3', 'float32x3']),
    })
    const pipeline = await init.device.createRenderPipelineAsync(descriptor);

    // pipeline for wireframe
    const descriptor2 = ws.createRenderPipelineDescriptor({
        init,
        primitiveType: 'line-list',
        vsShader: vert_shader,
        fsShader: frag_shader,
        buffers: ws.setVertexBuffers(['float32x3', 'float32x3']),
    })
    const pipeline2 = await init.device.createRenderPipelineAsync(descriptor2);

    // create vertex and index buffers
    const positionBuffer = ws.createBufferWithData(init.device, data.positions);
    const normalBuffer = ws.createBufferWithData(init.device, data.normals);
    const indexBuffer = ws.createBufferWithData(init.device, data.indices);
    const indexBuffer2 = ws.createBufferWithData(init.device, data.indices2);

    // uniform buffer for model-matrix, vp-matrix, and normal-matrix
    const  uniformBuffer = ws.createBuffer(init.device, 192);

    // light uniform buffers for shape and wireframe
    const  lightUniformBuffer = ws.createBuffer(init.device, 64);
    const  lightUniformBuffer2 = ws.createBuffer(init.device, 64);

    // uniform buffer for material
    const materialUniformBuffer = ws.createBuffer(init.device, 16);
    
    // uniform bind group for vertex shader
    const vertBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(0), [uniformBuffer]);
    const vertBindGroup2 = ws.createBindGroup(init.device, pipeline2.getBindGroupLayout(0), [uniformBuffer]);

    // uniform bind group for fragment shader
    const fragBindGroup = ws.createBindGroup(init.device, pipeline.getBindGroupLayout(1), 
        [lightUniformBuffer, materialUniformBuffer]);
    const fragBindGroup2 = ws.createBindGroup(init.device, pipeline2.getBindGroupLayout(1), 
        [lightUniformBuffer2, materialUniformBuffer]);

    // create depth view
    const depthTexture = ws.createDepthTexture(init);

    // create texture view for MASS (count = 4)
    const msaaTexture = ws.createMultiSampleTexture(init);
   
    return {
        pipelines: [pipeline, pipeline2],
        vertexBuffers: [positionBuffer, normalBuffer, indexBuffer, indexBuffer2],
        uniformBuffers: [uniformBuffer, lightUniformBuffer, materialUniformBuffer, lightUniformBuffer2],
        uniformBindGroups: [vertBindGroup, fragBindGroup, vertBindGroup2, fragBindGroup2],
        depthTextures: [depthTexture],
        gpuTextures: [msaaTexture],
    };
}

export const draw = (init:ws.IWebGPUInit, p:ws.IPipeline, plotType:string, data:any) => {  
    const commandEncoder =  init.device.createCommandEncoder();
    const descriptor = ws.createRenderPassDescriptor({
        init,
        depthView: p.depthTextures[0].createView(),
        textureView: p.gpuTextures[0].createView(),
    });
    const renderPass = commandEncoder.beginRenderPass(descriptor);
    
    // draw shape
    const drawShape = () => {
        renderPass.setPipeline(p.pipelines[0]);
        renderPass.setVertexBuffer(0, p.vertexBuffers[0]);
        renderPass.setVertexBuffer(1, p.vertexBuffers[1]);
        renderPass.setBindGroup(0, p.uniformBindGroups[0]);
        renderPass.setBindGroup(1, p.uniformBindGroups[1]);
        renderPass.setIndexBuffer(p.vertexBuffers[2], 'uint32');
        renderPass.drawIndexed(data.indices.length);
    }

    // draw wireframe
    const drawWireframe = () => {
        renderPass.setPipeline(p.pipelines[1]);
        renderPass.setVertexBuffer(0, p.vertexBuffers[0]);
        renderPass.setVertexBuffer(1, p.vertexBuffers[1]);
        renderPass.setBindGroup(0, p.uniformBindGroups[2]);
        renderPass.setBindGroup(1, p.uniformBindGroups[3]);
        renderPass.setIndexBuffer(p.vertexBuffers[3], 'uint32');
        renderPass.drawIndexed(data.indices2.length);
    }

    if(plotType === 'wireframeOnly'){
        drawWireframe();
    } else if(plotType === 'shapeOnly'){
        drawShape();
    } else {
        drawShape();
        drawWireframe();
    }

    renderPass.end();
    init.device.queue.submit([commandEncoder.finish()]);
}

const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    const init = await ws.initWebGPU({canvas, msaaCount: 4});

    let data = getSphereData(2, 20, 32);
    const p = await createPipeline(init, data);
       
    let modelMat = mat4.create();
    let vt = ws.createViewTransform();
    let viewMat = vt.viewMat;

    let aspect = init.size.width / init.size.height;  
    let rotation = vec3.fromValues(0, 0, 0);    
    let projectMat = ws.createProjectionMat(aspect);
    let vpMat = ws.combineVpMat(viewMat, projectMat);
    init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);

    let camera = ws.getCamera(canvas, vt.cameraOptions);     
    let eyePosition = new Float32Array(vt.cameraOptions.eye);
    let lightPosition = eyePosition;

    // write light parameters to buffer 
    init.device.queue.writeBuffer(p.uniformBuffers[1], 0, lightPosition);
    init.device.queue.writeBuffer(p.uniformBuffers[1], 16, eyePosition);
    init.device.queue.writeBuffer(p.uniformBuffers[3], 0, lightPosition);
    init.device.queue.writeBuffer(p.uniformBuffers[3], 16, eyePosition);
   
    var gui = ws.getDatGui();
    document.querySelector('#gui').append(gui.domElement);
    const params = {
        rotationSpeed: 0.9,
        objectColor: '#ff0000',
        wireframeColor: '#ffff00',
        plotType: 'shapeAndWireframe',
        uSegments: 20,
        vSegments: 32,
        radius: 2,
        specularColor: '#ffffff',
        ambient: 0.2,
        diffuse: 0.8,
        specular: 0.4,
        shininess: 30,
    };
    let lightChanged = true;
    let dataChanged = false;
   
    gui.add(params, 'rotationSpeed', 0, 5, 0.1);      
    gui.addColor(params, 'objectColor').onChange(()=>{ lightChanged = true; });
    gui.addColor(params, 'wireframeColor').onChange(()=>{ lightChanged = true; });
    gui.add(params, 'plotType', ['shapeAndWireframe', 'shapeOnly', 'wireframeOnly']);

    var folder = gui.addFolder('SetSphereParameters');
    folder.open();
    folder.add(params, 'uSegments', 5, 100, 1).onChange(() => { dataChanged = true; });
    folder.add(params, 'vSegments', 5, 100, 1).onChange(() => { dataChanged = true; });
    folder.add(params, 'radius', 0.1, 5, 0.1).onChange(() => { dataChanged = true; }); 

    folder = gui.addFolder('Set lighting parameters');
    folder.open();
    folder.add(params, 'ambient', 0, 1, 0.02).onChange(()=>{ lightChanged = true; });  
    folder.add(params, 'diffuse', 0, 1, 0.02).onChange(()=>{ lightChanged = true; });  
    folder.addColor(params, 'specularColor').onChange(()=>{ lightChanged = true; });
    folder.add(params, 'specular', 0, 1, 0.02).onChange(()=>{ lightChanged = true; });  
    folder.add(params, 'shininess', 1, 300, 1).onChange(()=>{ lightChanged = true; });  

    var stats = ws.getStats();
    let start = Date.now();
    const frame = () => {  
        stats.begin(); 
        projectMat = ws.createProjectionMat(aspect);
        if(camera.tick()){
            viewMat = camera.matrix;
            vpMat = ws.combineVpMat(viewMat, projectMat);
            eyePosition = new Float32Array(camera.eye.flat());
            lightPosition = eyePosition;
            //cc.updateViewProjection(init.device, p, vpMat, lightPosition, eyePosition);
            init.device.queue.writeBuffer(p.uniformBuffers[0], 0, vpMat as ArrayBuffer);
            init.device.queue.writeBuffer(p.uniformBuffers[1], 0, lightPosition);
            init.device.queue.writeBuffer(p.uniformBuffers[1], 16, eyePosition);
            init.device.queue.writeBuffer(p.uniformBuffers[3], 0, lightPosition);
            init.device.queue.writeBuffer(p.uniformBuffers[3], 16, eyePosition);
        }
        var dt = (Date.now() - start)/1000;        
        rotation[0] = Math.sin(dt * params.rotationSpeed);
        rotation[1] = Math.cos(dt * params.rotationSpeed); 
        modelMat = ws.createModelMat([0,0,0], rotation);
        const normalMat = ws.createNormalMat(modelMat);
    
        // update uniform buffers for transformation
        init.device.queue.writeBuffer(p.uniformBuffers[0], 64, modelMat as ArrayBuffer);  
        init.device.queue.writeBuffer(p.uniformBuffers[0], 128, normalMat as ArrayBuffer);  
       
        if(lightChanged){
            // update uniform buffers for light colors
            init.device.queue.writeBuffer(p.uniformBuffers[1], 32, ws.hex2rgb(params.objectColor));
            init.device.queue.writeBuffer(p.uniformBuffers[1], 48, ws.hex2rgb(params.specularColor));
            init.device.queue.writeBuffer(p.uniformBuffers[3], 32, ws.hex2rgb(params.wireframeColor));
            init.device.queue.writeBuffer(p.uniformBuffers[3], 48, ws.hex2rgb(params.specularColor));
    
            // update uniform buffer for material
            init.device.queue.writeBuffer(p.uniformBuffers[2], 0, new Float32Array([
                params.ambient, params.diffuse, params.specular, params.shininess
            ]));
            lightChanged = false;
        }
       
        if(dataChanged){
            const len0 = data.positions.length;
            data = getSphereData(params.radius, params.uSegments, params.vSegments);
            const pData = [data.positions, data.normals, data.indices, data.indices2];
            ws.updateVertexBuffers(init.device, p, pData, len0);
            dataChanged = false;
        }
        
        draw(init, p, params.plotType, data); 

        requestAnimationFrame(frame);
        stats.end();
    };
    frame();
}

run();