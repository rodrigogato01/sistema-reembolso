import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// SUA CHAVE DA VIZZION (Confirme se não há espaços extras)
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO TRANSAÇÃO (V12 - CORREÇÃO CREDENCIAIS)");

    try {
        let { valor, name, cpf, email, phone } = req.body;

        // 1. DADOS PADRÃO
        if (!valor) valor = 27.90;
        const amountNumber = parseFloat(valor.toString());

        const uniqueId = `ID-${Date.now()}`;
        
        // Data de vencimento (amanhã)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        const formattedDate = dueDate.toISOString().split('T')[0];

        // CPF Limpo
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : "12345678900";

        // 2. PAYLOAD CONFORME DOC
        const payloadVizzion = {
            identifier: uniqueId,
            amount: amountNumber,
            client: {
                name: name || "Cliente Consumidor",
                email: email || "cliente@email.com",
                phone: phone || "(11) 99999-9999",
                document: cpfLimpo // Formato apenas números costuma ser mais seguro
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

        console.log("Enviando Payload:", JSON.stringify(payloadVizzion));

        // 3. ENVIO COM CABEÇALHO DE AUTENTICAÇÃO REFORÇADO
        const response = await axios.post(API_URL, payloadVizzion, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`, // Formato padrão Bearer
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 20000
        });

        console.log("✅ VIZZION RESPONDEU 201:", response.status);
        
        const data = response.data;
        // Captura o Pix
        const payloadPix = data.pix?.qrcode_text || data.pix?.payload || "";
        const imagemPix = data.pix?.qrcode_image || data.pix?.base64 || "";

        return res.json({ success: true, payload: payloadPix, encodedImage: imagemPix });

    } catch (error: any) {
        console.error("❌ FALHA NO SERVER:");
        
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Erro: ${JSON.stringify(error.response.data)}`);
            
            // Se o erro for 401 ou 403, confirma problema de credencial
            const msg = error.response.data.message || JSON.stringify(error.response.data);
            return res.json({ success: false, message: `Erro Vizzion (${error.response.status}): ${msg}` });
        }
        
        return res.json({ 
            success: false, 
            message: error.message || "Erro desconhecido no servidor." 
        });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR V12 RODANDO NA PORTA ${PORT}`));
