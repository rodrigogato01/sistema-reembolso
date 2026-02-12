import express from 'express';
import cors from 'cors';
import { PixController } from './controllers/PixController';

const app = express();
app.use(cors()); 
app.use(express.json());

// Instancia o controlador da Efí
const pixController = new PixController();

// --- ROTA DE BOAS-VINDAS (Resolve o erro "Cannot GET /") ---
app.get('/', (req, res) => {
    res.send('Servidor do Pix está Online e Pronto! 🚀');
});

// --- ROTAS DO PIX (Conectadas ao PixController da Efí) ---
app.post('/pix', pixController.create);
app.get('/pix/status/:id', pixController.checkStatus);
app.post('/webhook', pixController.webhook);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
