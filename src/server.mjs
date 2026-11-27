import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
const model = process.env.AI_MODEL || 'gpt-4o-mini';
const apiUrl = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const maxBodyBytes = 64 * 1024;
const maxRequestsPerMinute = Math.max(1, Number(process.env.AI_MAX_REQUESTS_PER_MINUTE || 12));
const requestWindows = new Map();

function sendJson(response, status, data) {
  response.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  response.end(JSON.stringify(data));
}
function clientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || request.socket.remoteAddress || 'unknown';
}
function allowRequest(request) {
  const now = Date.now(), key = clientIp(request);
  let window = requestWindows.get(key);
  if (!window || now - window.startedAt >= 60_000) window = {startedAt:now,count:0};
  window.count += 1;
  requestWindows.set(key,window);
  if (requestWindows.size > 5000) for (const [ip,entry] of requestWindows) if (now-entry.startedAt >= 60_000) requestWindows.delete(ip);
  return window.count <= maxRequestsPerMinute;
}
async function readJson(request) {
  const chunks=[]; let size=0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw Object.assign(new Error('too-large'),{status:413});
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('invalid-json'),{status:400}); }
}
function validateMessages(messages) {
  return Array.isArray(messages) && messages.length === 2 && messages[0]?.role === 'system' && messages[1]?.role === 'user' &&
    messages.every(message => typeof message.content === 'string' && message.content.length <= 24_000);
}
const server=http.createServer(async (request,response)=>{
  const url=new URL(request.url||'/','http://localhost');
  if(request.method==='GET'&&url.pathname==='/healthz') return sendJson(response,200,{status:'ok'});
  if(request.method==='GET'&&url.pathname==='/api/ai/config') return sendJson(response,200,{configured:Boolean(apiKey),model});
  if(request.method==='POST'&&url.pathname==='/api/ai'){
    if(!allowRequest(request)) return sendJson(response,429,{error:'rate_limit'});
    if(!apiKey) return sendJson(response,503,{error:'api_key_not_configured'});
    let target; try{target=new URL(apiUrl)}catch{return sendJson(response,500,{error:'invalid_api_url'})}
    const localHttp=target.protocol==='http:'&&['localhost','127.0.0.1','::1'].includes(target.hostname);
    if(target.protocol!=='https:'&&!localHttp) return sendJson(response,500,{error:'https_required'});
    let body; try{body=await readJson(request)}catch(error){return sendJson(response,error.status||400,{error:error.message})}
    if(!validateMessages(body?.messages)) return sendJson(response,400,{error:'invalid_messages'});
    try{
      const upstream=await fetch(target,{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},
        body:JSON.stringify({model,messages:body.messages,temperature:0.2,max_tokens:1000}),redirect:'error',signal:AbortSignal.timeout(30_000)});
      if(!upstream.ok){console.warn(`AI provider returned HTTP ${upstream.status}`);return sendJson(response,upstream.status===429?429:502,{error:'provider_request_failed'})}
      const data=await upstream.json(),content=data?.choices?.[0]?.message?.content;
      if(typeof content!=='string'&&!Array.isArray(content)) return sendJson(response,502,{error:'invalid_provider_response'});
      return sendJson(response,200,{choices:[{message:{content}}]});
    }catch{return sendJson(response,502,{error:'provider_unreachable'})}
  }
  if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/DataClinic-보완.html')){
    try{const html=await readFile(path.join(here,'DataClinic-보완.html'));response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});return response.end(html)}
    catch{return sendJson(response,500,{error:'app_file_missing'})}
  }
  return sendJson(response,404,{error:'not_found'});
});
server.listen(port,host,()=>console.log(`DataClinic server listening on ${host}:${port}`));
