import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 CHAVE VIZZION AQUI (COLOQUE A NOVA CHAVE GERADA)
const KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
// =====================================================

// "Banco de Dados" em memória para armazenar as transações geradas
const bancoTransacoes = new Map();

// =====================================================
// 👉 AQUI ESTÁ A MÁGICA PARA APARECER A SUA PÁGINA
// =====================================================
app.use(express.static(path.resolve())); 

app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

// =====================================================
// ROTA 1: GERA O PIX (SUA LÓGICA ORIGINAL INTACTA)
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : ""; 
        const phoneLimpo = phone ? phone.replace(/\D/g, '') : "";
        const valorFixo = parseFloat(valor) || 27.90; 

        const identifier = `ID-${Date.now()}`; 

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { name: name || "Cliente", email: email || "email@teste.com", document: cpfLimpo, phone: phoneLimpo },
            products: [{ id: "TAXA", name: "Taxa Liberacao", quantity: 1, price: valorFixo }],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
        };

        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
        });

        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text || response.data.payload,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image || response.data.encodedImage,
            transactionId: identifier 
        });

    } catch (error: any) {
        return res.json({ success: false, message: `Erro: ${error.message}` });
    }
});

// =====================================================
// ROTA 2: O WEBHOOK
// =====================================================
app.post('/webhook', (req, res) => {
    const { transaction_id, identifier, status, payment_method, amount, event } = req.body;
    const idBusca = identifier || transaction_id;

    if (payment_method === 'PIX' && status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);
            if (Number(transacao.amount) === Number(amount)) {
                bancoTransacoes.set(idBusca, { status: 'paid', amount: amount });
            }
        }
    }
    return res.status(200).send("OK");
});

// =====================================================
// ROTA 3: POLLING
// =====================================================
app.get('/check-status/:id', (req, res) => {
    const id = req.params.id;
    const transacao = bancoTransacoes.get(id);

    if (transacao && transacao.status === 'paid') {
        return res.json({ paid: true }); 
    } else {
        return res.json({ paid: false }); 
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Servidor com Webhook Rodando"));
