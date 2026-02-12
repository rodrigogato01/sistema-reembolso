import express from 'express';
import cors from 'cors';
import path from 'path';
import { PixController } from './controllers/PixController';

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO PARA AS SUAS PÁGINAS APARECEREM ---
// Isso diz ao servidor para reconhecer seus arquivos HTML, CSS e Imagens
app.use(express.static(process.cwd()));

const pixController = new PixController();

// Rota para abrir a sua primeira página (Etapa 1)
app.get('/', (req, res) => {
    // Certifique-se que o seu primeiro arquivo se chama 'index.html'
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

// Mantendo as rotas do Pix funcionando para o botão
app.post('/pix', pixController.create);
app.get('/pix/status/:id', pixController.checkStatus);
app.post('/webhook', pixController.webhook);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
