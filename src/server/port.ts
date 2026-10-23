import net from 'node:net';

export const DEFAULT_PORT = 5178;
const MAX_ATTEMPTS = 20;

function isFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, host, () => srv.close(() => resolve(true)));
  });
}

/** First free port in [start, start + 20] on the IPv4 loopback interface. */
export async function findPort(start = DEFAULT_PORT): Promise<number> {
  for (let port = start; port <= start + MAX_ATTEMPTS; port++) {
    if (!(await isFree(port, '127.0.0.1'))) continue;
    return port;
  }
  throw new Error(`no free port in ${start}-${start + MAX_ATTEMPTS}`);
}
