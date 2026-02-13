import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// SUA CHAVE
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';

// A URL QUE VOCÊ ACHOU
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO TRANSAÇÃO (VERSÃO V5 - URL NOVA)");

    try {
        let { valor, name, cpf } = req.body;

        // Garante dados mínimos para não travar
        if (!valor) valor = "27.90";
        if (!name || name.length < 3) name = "Cliente Resgate";
        if (!cpf || cpf.length < 11) cpf = "12345678909";

        // Vizzion geralmente pede centavos (ex: 2790) ou float (27.90)
        // Vamos tentar enviar como número float primeiro
        const amount = parseFloat(valor); 

        console.log(`Enviando R$ ${amount} para ${API_URL}`);

        const response = await axios.post(API_URL, {
            amount: amount, 
            payment_method: 'pix',
            payer: { // A Vizzion pode usar 'payer' ou 'customer'
                name: name,
                document: cpf.replace(/\D/g, ''),
                email: "cliente@pagamento.com"
            }
        }, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 15000
        });

        console.log("SUCESSO VIZZION:", response.data);

        const data = response.data;
        // Tenta pegar o código em qualquer formato que eles devolvam
        const payload = data.qr_code || data.pix_code || data.emv || data.payload;
        const imagem = data.qr_code_base64 || data.encodedImage || data.pix_qrcode;

        return res.json({ success: true, payload: payload, encodedImage: imagem });

    } catch (error: any) {
        console.error("❌ ERRO VIZZION:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Detalhe:", JSON.stringify(error.response.data));
            return res.json({ success: false, message: `Erro Vizzion: ${error.response.status} - Verifique os Logs` });
        } else {
            console.error("Erro Conexão:", error.message);
            return res.json({ success: false, message: "Erro ao conectar na URL nova." });
        }
    }
});

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR V5 RODANDO NA PORTA ${PORT}`));
