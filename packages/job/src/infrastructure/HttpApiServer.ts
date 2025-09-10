import http, { IncomingMessage, ServerResponse } from 'http';
import { JobManager } from '../application/JobManager';
import { JobScheduler } from '../application/JobScheduler';
import { JobConfig } from '../domain/types';

function send(res: ServerResponse, status: number, body: any) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(json);
}

async function parseJson(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function startHttpApi(manager: JobManager, scheduler: JobScheduler, port = 8787) {
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';

    try {
      if (method === 'GET' && url === '/health') {
        return send(res, 200, { ok: true });
      }

      if (method === 'GET' && url === '/jobs') {
        const jobs = await manager.list();
        return send(res, 200, { jobs });
      }

      if (method === 'PUT' && url.startsWith('/jobs/')) {
        const id = decodeURIComponent(url.split('/')[2] || '');
        const body = (await parseJson(req)) as Partial<JobConfig>;
        const job = await manager.upsert({
          id,
          channelId: body.channelId ?? id,
          intervalSec: body.intervalSec ?? 1800,
          mode: body.mode ?? 'or',
          keyword: body.keyword,
          keywordOr: body.keywordOr,
          rangeDays: body.rangeDays ?? 14,
          location: body.location,
          order: body.order as 1 | 2 | 3 | undefined,
        });
        await scheduler.restart(job.id);
        return send(res, 200, { job });
      }

      if (method === 'DELETE' && url.startsWith('/jobs/')) {
        const id = decodeURIComponent(url.split('/')[2] || '');
        await scheduler.stop(id);
        await manager.remove(id);
        return send(res, 200, { deleted: id });
      }

      if (method === 'POST' && url.startsWith('/jobs/') && url.endsWith('/run')) {
        const id = decodeURIComponent(url.split('/')[2] || '');
        const resp = await manager.runOnce(id);
        return send(res, 200, { events: resp.events });
      }

      send(res, 404, { error: 'Not found' });
    } catch (e: any) {
      send(res, 500, { error: e?.message || String(e) });
    }
  });

  server.listen(port);
  return server;
}
