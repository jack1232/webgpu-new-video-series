export const checkWebGPUSupport = navigator.gpu? 'Great, your current browser supports WebGPU!' : 
    `Your current browser does not support WebGPU! Make sure you are on a system 
    with WebGPU enabled.`;
