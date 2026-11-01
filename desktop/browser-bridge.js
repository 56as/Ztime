import http from 'node:http';
import {randomBytes, createHash} from 'node:crypto';
import {readJson, send} from './protocol.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const browserApps = new Set(['chrome.exe', 'msedge.exe']);
export function validSite(host) {
  return typeof host === 'string' && host.length <= 253 &&
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(host);
}

export class BrowserBridge {
  constructor(store, port = 40329) {
    this.store = store;
    this.port = port;
    this.contexts = new Map();
    this.queue = Promise.resolve();
  }
  status() {
    return {enabled: Boolean(this.store.get('extensionTokenHash')), listening: Boolean(this.server?.listening)};
  }
  async listen() {
    if (this.server?.listening) return;
    const server = http.createServer((req,res) => this.receive(req,res));
    await new Promise((resolve,reject) => {
      server.once('error',reject);
      server.listen(this.port,'127.0.0.1',resolve);
    });
    this.server = server;
  }
  configure(enabled) {
    const operation = this.queue.then(async () => {
      this.contexts.clear();
      if (!enabled) {
        this.store.set('extensionTokenHash', null);
        this.close();
        return {enabled:false};
      }
      await this.listen();
      const token = randomBytes(32).toString('hex');
      this.store.set('extensionTokenHash', digest(token));
      return {enabled:true,token};
    });
    this.queue = operation.catch(()=>{});
    return operation;
  }
  async receive(req,res) {
    try {
      if (req.headers.host !== '127.0.0.1:'+this.server?.address()?.port ||
          req.url !== '/context' || req.method !== 'POST' ||
          !/^chrome-extension:\/\/[a-p]{32}$/.test(req.headers.origin ?? '')) {
        return send(res,403,{error:'仅接受本机浏览器扩展'});
      }
      // Validate again after reading so rotating or revoking the token also cancels in-flight writes.
      const body = await readJson(req);
      const token = (req.headers.authorization ?? '').replace(/^Bearer /,'');
      if (!/^[0-9a-f]{64}$/.test(token) || digest(token) !== this.store.get('extensionTokenHash'))
        return send(res,401,{error:'请重新连接扩展'});
      if (!browserApps.has(body.app) || !/^[\w-]{1,64}$/.test(body.client ?? '') ||
          (body.host !== null && !validSite(body.host))) return send(res,400,{error:'网站数据无效'});
      const now = Date.now();
      for (const [id,v] of this.contexts) if (now-v.at>45000) this.contexts.delete(id);
      if (body.host && !this.store.get('paused',false))
        this.contexts.set(body.client,{app:body.app,host:body.host,at:now});
      else this.contexts.delete(body.client);
      send(res,200,{ok:true});
    } catch {send(res,400,{error:'请求无效'});}
  }
  hostFor(app,now) {
    let latest;
    for (const v of this.contexts.values())
      if (v.app===app && now>=v.at && now-v.at<=45000 && (!latest || latest.at<v.at)) latest=v;
    return latest?.host ?? null;
  }
  close() {
    this.contexts.clear();
    this.server?.close();
    this.server = null;
  }
}
