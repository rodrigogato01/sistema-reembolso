import express from 'express';
import cors from 'cors';
import path from 'path';
import { PixController } from './controllers/PixController';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(process.cwd()));

const pixController = new PixController();

app.get('/', (req, res) => {
    res.json({ status: 'Servidor EFI online', timestamp: new Date().toISOString() });
});

app.post('/pix', pixController.create);
app.get('/pix/status/:id', pixController.checkStatus);
app.post('/webhook', pixController.webhook);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor EFI rodando na porta ${PORT}`));
