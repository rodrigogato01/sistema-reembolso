import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// Serve os arquivos HTML (Seus checkouts)
app.use(express.static(process.cwd()));

// SUA CHAVE DA VIZZION PAY
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';

// Rota Genérica para Criar Pix na Vizzion
app.post('/pix', async (req, res) => {
    try {
        const { name, cpf, email, phone, valor } = req.body;

        console.log(`Gerando Pix Vizzion: ${name} - R$ ${valor}`);

        // A Vizzion geralmente pede o valor em CENTAVOS (ex: 27.90 vira 2790)
        // Se a sua conta estiver configurada para receber em reais, mude aqui.
        const valorEmCentavos = Math.round(parseFloat(valor) * 100);

        const response = await axios.post('https://api.vizzionpay.com/v1/transactions', {
            amount: valorEmCentavos,
            payment_method: 'pix',
            customer: {
                name: name,
                document: cpf.replace(/\D/g, ''), // CPF sem pontuação
                email: email,
                phone: phone.replace(/\D/g, '')   // Telefone sem pontuação
            },
            postback_url: 'https://checkout-pix-profissional.onrender.com/webhook' // Seu webhook (opcional)
        }, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        // O retorno da API da Vizzion costuma trazer o qrcode e o payload
        const data = response.data;
        
        // Adaptação para o seu Frontend não quebrar
        // Verifica como a Vizzion devolve (geralmente é pix_qrcode e pix_code)
        const payloadPix = data.pix_code || data.qrcode_text || data.payload;
        const imagemPix = data.pix_qrcode || data.qrcode_image || data.encodedImage;

        return res.json({
            success: true,
            payload: payloadPix,     // O código Copia e Cola
            encodedImage: imagemPix, // A imagem Base64 (se vier)
            id_transacao: data.id
        });

    } catch (error: any) {
        console.error("Erro Vizzion:", error.response?.data || error.message);
        return res.status(500).json({ 
            success: false, 
            message: "Erro ao comunicar com Vizzion Pay." 
        });
    }
});

// Webhook para receber aprovação (Opicional)
app.post('/webhook', (req, res) => {
    console.log("Webhook recebido:", req.body);
    res.status(200).send('OK');
});

// Rotas para abrir seus arquivos HTML
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));
app.get('/iof', (req, res) => res.sendFile(path.join(process.cwd(), 'iof.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
