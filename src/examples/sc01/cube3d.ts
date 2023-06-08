import shader from './unlit-vertex-color.wgsl';
import { getCubeData } from '../../common/vertex-data';
import { vec3, mat4 } from 'gl-matrix';
const createCamera = require('3d-view-controls');
import { GUI } from 'dat.gui';
import * as Stats from 'stats.js';

// #region helper functions ******************************************
const createModelMat = (translation:vec3=[0,0,0], rotation:vec3=[0,0,0], scale:vec3=[1,1,1]): mat4 => {
    const modelMat = mat4.create();
    mat4.translate(modelMat, modelMat, translation);
    mat4.rotateX(modelMat, modelMat, rotation[0]);
    mat4.rotateY(modelMat, modelMat, rotation[1]);
    mat4.rotateZ(modelMat, modelMat, rotation[2]);
    mat4.scale(modelMat, modelMat, scale);
    return modelMat;
}

const combineMvpMat = (modelMat:mat4, viewMat:mat4, projectionMat:mat4): mat4 => {
    const mvpMat = mat4.create();
    mat4.multiply(mvpMat, viewMat, modelMat);
    mat4.multiply(mvpMat, projectionMat, mvpMat);
    return mvpMat;
} 

interface IPipeline {
    pipelines?: GPURenderPipeline[],
    depthTextures?: GPUTexture[],
    vertexBuffers?: GPUBuffer[],
    uniformBuffers?: GPUBuffer[],
    uniformBindGroups?: GPUBindGroup[],
}
// #endregion helper functions ******************************************

const createPipeline = async (device:GPUDevice, size:any, data: any): Promise<IPipeline> => {
    const descriptor:GPURenderPipelineDescriptor = {
        "layout": "auto",
        "vertex": {
            "module": device.createShaderModule({
                code: shader,
            }),
            "entryPoint": "vs_main",
            "buffers": [
                {
                    "arrayStride": 12,
                    "attributes": [
                        {
                            "shaderLocation": 0,
                            "format": "float32x3",
                            "offset": 0
                        }
                    ]
                },
                {
                    "arrayStride": 12,
                    "attributes": [
                        {
                            "shaderLocation": 1,
                            "format": "float32x3",
                            "offset": 0
                        }
                    ]
                }
            ]
        },
        "fragment": {
            "module": device.createShaderModule({
                code: shader,
            }),
            "entryPoint": "fs_main",
            "targets": [
                {
                    "format": "bgra8unorm"
                }
            ]
        },
        "primitive": {
            "topology": "triangle-list",
            "cullMode": "none"
        },
        "multisample": {
            "count": 1
        },
        "depthStencil": {
            "format": "depth24plus",
            "depthWriteEnabled": true,
            "depthCompare": "less"
        }
    };
    const pipeline = await device.createRenderPipelineAsync(descriptor);

    // create vertex buffers
    const positionBuffer = device.createBuffer({
        size: data.positions.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(positionBuffer.getMappedRange()).set(data.positions);
    positionBuffer.unmap();

    const colorBuffer = device.createBuffer({
        size: data.colors.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(colorBuffer.getMappedRange()).set(data.colors);
    colorBuffer.unmap();

    const indexBuffer = device.createBuffer({
        size: data.indices.byteLength,
        usage: GPUBufferUsage.INDEX,
        mappedAtCreation: true,
    });
    new Uint32Array(indexBuffer.getMappedRange()).set(data.indices);
    indexBuffer.unmap();

    // create uniform buffer and bind group for pass mvp matrix
    const uniformBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    
    const uniformBindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: uniformBuffer,
                    offset: 0,
                    size: 64,
                }
            }
        ]
    });
    
    // create depth texture
    const depthTexture = device.createTexture({
        size: size,
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    
    return {
        pipelines: [pipeline],
        vertexBuffers: [positionBuffer, colorBuffer, indexBuffer],
        uniformBuffers: [uniformBuffer],
        uniformBindGroups: [uniformBindGroup],
        depthTextures: [depthTexture],
    };
}

const draw = (device: GPUDevice, context:GPUCanvasContext, p:IPipeline, data:any) => {  
    const commandEncoder =  device.createCommandEncoder();
    const background = { r: 0.009, g: 0.0125, b: 0.0164, a: 1.0 };
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view:  context.getCurrentTexture().createView(),
            clearValue: background,
            loadOp:'clear',
            storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: p.depthTextures[0].createView(),
            depthClearValue: 1.0,
            depthLoadOp:"clear",
            depthStoreOp: "store",
        },
    });
    
    renderPass.setPipeline(p.pipelines[0]);
    renderPass.setVertexBuffer(0, p.vertexBuffers[0]);
    renderPass.setVertexBuffer(1, p.vertexBuffers[1]);
    renderPass.setBindGroup(0, p.uniformBindGroups[0]);
    renderPass.setIndexBuffer(p.vertexBuffers[2], 'uint32');
    renderPass.drawIndexed(data.indices.length);
    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
}

const run = async () => {
    const canvas = document.getElementById('canvas-webgpu') as HTMLCanvasElement;
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    const size = { width: canvas.width, height: canvas.height };

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext;

    context.configure({
        device: device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'opaque',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    
    const data = getCubeData();
    const p = await createPipeline(device, size, data);
    
    let modelMat = mat4.create();
    let cameraPos:vec3 = [2,2,4];
    let lookDir:vec3 = [0,0,0];
    let viewMat = mat4.create();
    mat4.lookAt(viewMat, cameraPos, lookDir, [0,1,0]);
    let projectMat = mat4.create();
    let mvpMat = mat4.create();
   
    let aspect = size.width / size.height;  
    let rotation = vec3.fromValues(0, 0, 0);   
    
    let cameraOption = {
        eye: cameraPos,
        center: lookDir,
        zoomMax: 1000,
        zoomSpeed: 2
    }
    var camera = createCamera(canvas, cameraOption);
 
    var gui = new GUI();
    document.querySelector('#gui').append(gui.domElement);

    const params = {
        rotationSpeed: 0.9,
    };    
    gui.add(params, 'rotationSpeed', 0, 5, 0.1);      

    var stats = new Stats();
    stats.dom.style.cssText = 'position:relative;top:0;left:0';
    stats.showPanel(1);
    document.querySelector('#stats').appendChild(stats.dom);

    let start = performance.now();
    const frame = () => {     
        stats.begin();
      
        mat4.perspective(projectMat, 2*Math.PI/5, aspect, 0.1, 1000.0);    
        if(camera.tick()){
            viewMat = camera.matrix;
        }
        var dt = (performance.now() - start)/1000;             
        rotation[0] = Math.sin(dt * params.rotationSpeed);
        rotation[1] = Math.cos(dt * params.rotationSpeed); 

        modelMat = createModelMat([0,0,0], rotation);
        mvpMat = combineMvpMat(modelMat, viewMat, projectMat);
        device.queue.writeBuffer(p.uniformBuffers[0], 0, mvpMat as ArrayBuffer);  
        draw(device, context, p, data);   
        
        requestAnimationFrame(frame);
        stats.end();        
    };
    frame();
}

run();