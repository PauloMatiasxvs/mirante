// Servidor local de desenvolvimento: entrega o site (pasta public/) e a rota
// /api/flights. Não precisa instalar nenhuma dependência: `npm start`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import voos from './api/flights.js';

const PUBLICO = resolve(fileURLToPath(new URL('.', import.meta.url)), 'public');
const PORTA = Number(process.env.PORT) || 5180;
const HOST = process.env.HOST || '127.0.0.1';

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
};

async function servirArquivo(caminho, res) {
  const relativo = caminho === '/' ? 'index.html' : caminho.replace(/^\/+/, '');
  const arquivo = resolve(PUBLICO, relativo);
  // Bloqueia "../" para fora da pasta public/.
  if (!arquivo.startsWith(PUBLICO + sep)) {
    res.statusCode = 403;
    res.end('Proibido');
    return;
  }
  try {
    const conteudo = await readFile(arquivo);
    res.setHeader('content-type', TIPOS[extname(arquivo)] || 'application/octet-stream');
    res.end(conteudo);
  } catch {
    res.statusCode = 404;
    res.end('Não encontrado');
  }
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/flights') return await voos(req, res);
    await servirArquivo(decodeURIComponent(pathname), res);
  } catch {
    res.statusCode = 400;
    res.end('Requisição inválida');
  }
}).listen(PORTA, HOST, () => {
  console.log(`Mirante rodando em http://localhost:${PORTA}`);
});
