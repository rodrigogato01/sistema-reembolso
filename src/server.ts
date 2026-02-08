import express from 'express';
import cors from 'cors';
import path from 'path';
import { PixController } from './controllers/PixController'; // Importamos o controlador direto

const app = express();
const pixController = new PixController(); // Ligamos o motor do Pix

app.use(cors());
app.use(express.json());

// --- AQUI ESTÃO AS ROTAS (GPS) ---
// Agora o servidor sabe exatamente o que fazer sem depender de outro arquivo
app.post('/pix', pixController.create);
app.get('/pix/:id', pixController.checkStatus);
app.post('/webhook', pixController.webhook);

// --- ROTA DO SITE ---
const publicPath = path.resolve(__dirname, '..', 'index.html');
app.get('/', (req, res) => {
    res.sendFile(publicPath, (err) => {
        if (err) res.status(500).send("Erro ao carregar site: " + err.message);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));