// Dependency-free local server for the included production build.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./dist/',import.meta.url));
const projectRoot=fileURLToPath(new URL('./',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.jsonl':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let target;if(pathname.startsWith('/examples/')){target=path.resolve(projectRoot,'.'+pathname);if(!target.startsWith(path.resolve(projectRoot,'examples'))){res.writeHead(403).end('Forbidden');return;}}else{target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!target.startsWith(root)){res.writeHead(403).end('Forbidden');return;}}if(!(await stat(target)).isFile())throw Error();res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(await readFile(target));}catch{res.writeHead(404).end('Not found');}});
server.listen(4173,'127.0.0.1',()=>console.log('Log Health: http://localhost:4173 (Ctrl+C to stop)'));
server.on('error',e=>{console.error(e.message);process.exitCode=1;});
