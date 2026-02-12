import express from 'express';
import cors from 'cors';
import path from 'path';
import { PixController } from './controllers/PixController';

const app = express();

// CORS e JSON
app.use(cors({ origin: '*' }));
app.use(express.json());

// Arquivos estáticos (HTML, CSS, JS do checkout)
app.use(express.static(process.cwd()));

const pixController = new PixController();

// ==========================================
// ROTAS DO CHECKOUT (seu funil)
// ==========================================

// Página inicial do checkout
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

// ==========================================
// ROTAS DO PIX (Mercado Pago)
// ==========================================

app.get('/api/status', (req, res) => {
    res.json({ status: 'Servidor online', pix: 'Mercado Pago', timestamp: new Date().toISOString() });
});

app.post('/pix', pixController.create);
app.get('/pix/status/:id', pixController.checkStatus);
app.post('/webhook', pixController.webhook);

// ==========================================
// TRATAMENTO DE ERROS
// ==========================================

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Erro:', err);
    res.status(500).json({ success: false, message: 'Erro interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Checkout + PIX rodando na porta ${PORT}`);
    console.log(`📦 Checkout: http://localhost:${PORT}`);
    console.log(`💰 API PIX: http://localhost:${PORT}/pix`);
});
