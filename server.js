import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Importação dos orquestradores
import { runConceitosAutomation } from './etapas/orquestrador_conceitos.js';
import { runPareceresAutomation } from './etapas/orquestrador_pareceres.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fastify = Fastify({ logger: false });

// 1. Configuração de CORS (Essencial para evitar bloqueios de método)
await fastify.register(cors, { 
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE']
});

// Armazém de logs em memória
const jobs = {};

// --- AS ROTAS DA API DEVEM VIR PRIMEIRO ---

// Rota de Status
fastify.get('/api/status/:jobId', async (request, reply) => {
  const { jobId } = request.params;
  return jobs[jobId] || { status: 'not_found', logs: ["⚠️ Job não encontrado."] };
});

// Rota do Robô de Conceitos
fastify.post('/api/run-conceitos', async (request, reply) => {
  const { user, password, diaryLink, avSelection, jsonData } = request.body;
  const jobId = crypto.randomUUID();
  jobs[jobId] = { status: 'running', logs: [] };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    jobs[jobId].logs.push(`[${time}] ${msg}`);
  };

  runConceitosAutomation({ user, password, diaryLink, avSelection, jsonData, addLog })
    .then(() => { jobs[jobId].status = 'completed'; })
    .catch(err => {
      jobs[jobId].status = 'error';
      jobs[jobId].logs.push(`❌ ERRO: ${err.message}`);
    });

  return { jobId };
});

// Rota do Robô de Pareceres
fastify.post('/api/run-pareceres', async (request, reply) => {
  // 1. Extraímos também o trSelection que o front-end enviou
  const { user, password, diaryLink, trSelection } = request.body;
  const jobId = crypto.randomUUID();
  jobs[jobId] = { status: 'running', logs: [] };

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    jobs[jobId].logs.push(`[${time}] ${msg}`);
  };

  // 2. Repassamos o trSelection para o orquestrador
  runPareceresAutomation({ user, password, diaryLink, trSelection, addLog })
    .then(() => { jobs[jobId].status = 'completed'; })
    .catch(err => {
      jobs[jobId].status = 'error';
      jobs[jobId].logs.push(`❌ ERRO: ${err.message}`);
    });

  return { jobId };
});

// --- O STATIC DEVE VIR POR ÚLTIMO ---
fastify.register(fastifyStatic, {
  root: __dirname,
  prefix: '/', 
});

const porta = process.env.PORT || 3000;

fastify.listen({ port: porta, host: '0.0.0.0' }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Servidor rodando em ${address}`);
});