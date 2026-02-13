import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO TRANSAÇÃO V11 (BASEADA NA DOC OFICIAL)");

    try {
        const { valor, name, cpf, email, phone } = req.body;

        // Formata os dados conforme a imagem da documentação
        const amountNumber = parseFloat(valor) || 27.90;
        const uniqueId = `ID-${Date.now()}`;
        
        // Data de vencimento (amanhã) no formato YYYY-MM-DD
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        const formattedDate = dueDate.toISOString().split('T')[0];

        const payloadVizzion = {
            identifier: uniqueId,
            amount: amountNumber, // Reais (Number)
            client: {
                name: name || "Cliente Shopee",
                email: email || "cliente@pagamento.com",
                phone: phone || "(11) 99999-9999",
                document: cpf || "123.456.789-00" // Formato com máscara
            },
            products: [
                {
                    id: "prod-001",
                    name: "Taxa de Desbloqueio",
                    quantity: 1,
                    price: amountNumber
                }
            ],
            dueDate: formattedDate
        };

        const response = await axios.post(API_URL, payloadVizzion, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("✅ VIZZION RESPONDEU 201");
        
        const data = response.data;
        // Captura dentro do objeto 'pix' retornado
        const payloadPix = data.pix?.qrcode_text || data.pix?.payload || "";
        const imagemPix = data.pix?.qrcode_image || data.pix?.base64 || "";

        return res.json({ success: true, payload: payloadPix, encodedImage: imagemPix });

    } catch (error: any) {
        console.error("❌ FALHA NO SERVER:");
        console.error(error.response?.data || error.message);
        return res.json({ 
            success: false, 
            message: error.response?.data?.message || "Erro na API da Vizzion" 
        });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR V11 RODANDO NA PORTA ${PORT}`));
