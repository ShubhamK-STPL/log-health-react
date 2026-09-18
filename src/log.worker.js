import {parseLog} from './analysis.mjs';
self.onmessage=async ({data:file})=>{try{self.postMessage({ok:true,...parseLog(await file.text())});}catch(error){self.postMessage({ok:false,message:error.message});}};
