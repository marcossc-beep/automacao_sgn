import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { runConceitosAutomation } from './etapas/orquestrador_conceitos.js';
import { runPareceresAutomation } from './etapas/orquestrador_pareceres.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fastify = Fastify({ logger: false });

fastify.register(cors);
fastify.register(fastifyStatic, { root: __dirname, prefix: '/' });

// Armazém de logs em memória
const jobs = {};

// Rota de Status (O front vai chamar isso a cada 2 segundos)
fastify.get('/api/status/:jobId', async (request, reply) => {
  const { jobId } = request.params;
  return jobs[jobId] || { status: 'not_found', logs: [] };
});

// Bot de Conceitos
fastify.post('/api/run-conceitos', async (request, reply) => {
  const { user, password, diaryLink, avSelection, jsonData } = request.body;
  const jobId = crypto.randomUUID();
  
  jobs[jobId] = { status: 'running', logs: [] };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    jobs[jobId].logs.push(`[${time}] ${msg}`);
  };

  runConceitosAutomation({ user, password, diaryLink, avSelection, jsonData, addLog })
    .then(() => jobs[jobId].status = 'completed')
    .catch(err => {
      jobs[jobId].status = 'error';
      jobs[jobId].logs.push(`❌ ERRO: ${err.message}`);
    });

  return { jobId };
});

fastify.post('/api/run-pareceres', async (request, reply) => {
  const { user, password, diaryLink } = request.body; // <-- Tirei o jsonData daqui
  const jobId = crypto.randomUUID();
  
  jobs[jobId] = { status: 'running', logs: [] };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    jobs[jobId].logs.push(`[${time}] ${msg}`);
  };

  runPareceresAutomation({ user, password, diaryLink, addLog }) // <-- Tirei daqui também
    .then(() => jobs[jobId].status = 'completed')
    .catch(err => {
      jobs[jobId].status = 'error';
      jobs[jobId].logs.push(`❌ ERRO: ${err.message}`);
    });

  return { jobId };
});

fastify.get('/', (req, reply) => reply.sendFile('index.html'));

fastify.listen({ port: 3000, host: '0.0.0.0' }, () => {
  console.log("🚀 Servidor rodando em http://localhost:3000");
});