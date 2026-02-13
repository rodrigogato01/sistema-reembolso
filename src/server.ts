import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// CONFIGURAÇÕES
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> PEDIDO RECEBIDO PELO SERVER (V10)");

    try {
        let { valor, name, cpf, email } = req.body;

        // Formatação dos dados para a Vizzion
        const amountFloat = parseFloat(valor) || 27.90;
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : "05350974033";
        const uniqueId = `ID-${Date.now()}`;

        // Chamada para a Vizzion seguindo a doc que você mandou
        const response = await axios.post(API_URL, {
            identifier: uniqueId,
            amount: amountFloat,
            client: {
                name: name || "Cliente Consumidor",
                email: email || "comprovante@pagamento.com",
                phone: "(11) 99999-9999",
                document: cpfLimpo
            }
        }, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ VIZZION RESPONDEU!");

        const data = response.data;
        
        // Pega o código Pix de dentro do objeto 'pix' (conforme a doc)
        let payload = "";
        let image = "";

        if (data.pix) {
            payload = data.pix.qrcode_text || data.pix.payload;
            image = data.pix.qrcode_image || data.pix.base64;
        } else {
            payload = data.qrcode_text || data.pix_code || data.payload;
            image = data.qrcode_image || data.encodedImage;
        }

        return res.json({ success: true, payload, encodedImage: image });

    } catch (error: any) {
        console.error("❌ ERRO NO SERVER:");
        console.error(error.response?.data || error.message);
        return res.json({ success: false, message: "Erro na API da Vizzion" });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVER RODANDO NA PORTA ${PORT}`));
