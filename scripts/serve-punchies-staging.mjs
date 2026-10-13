import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]),port=Number(process.argv[3]??5310);
if(!fs.existsSync(path.join(root,'stage.json')))throw Error('Build staging first');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.m4a':'audio/mp4','.mp3':'audio/mpeg','.css':'text/css'};
http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 let requested;try{requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return;}
 let file=path.resolve(root,'.'+requested);
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-store','Content-Length':fs.statSync(file).size});
 if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`Punchies staging http://127.0.0.1:${port}/`));
