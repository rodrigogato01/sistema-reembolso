import express from 'express';
import cors from 'cors';
import { PixController } from './controllers/PixController';

const app = express();
app.use(cors()); // Libera o acesso para o Elementor
app.use(express.json());

// Instancia o seu controlador da Efí
const pixController = new PixController();

// ROTAS CERTAS (Conectando ao PixController)
app.post('/pix', pixController.create);
app.get('/pix/status/:id', pixController.checkStatus);
app.post('/webhook', pixController.webhook);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
