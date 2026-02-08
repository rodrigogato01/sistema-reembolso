import express from 'express';
import cors from 'cors'; // Importa a permissão
import { router } from './routes';

const app = express();

// AQUI ESTÁ O SEGREDO: Libera o acesso para qualquer site (incluindo o seu teste local)
app.use(cors()); 

app.use(express.json());
app.use(router);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));