import express from 'express';
import cors from 'cors';
import path from 'path'; // <--- Importante para achar o arquivo
import { router } from './routes';

const app = express();

app.use(cors());
app.use(express.json());

// 1. Diz ao servidor onde estão os arquivos do site (na pasta raiz)
app.use(express.static(path.join(__dirname, '../')));

app.use(router);

// 2. Se alguém entrar na página principal, mostra o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));