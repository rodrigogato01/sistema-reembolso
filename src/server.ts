import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 SUA CHAVE VIZZION (Gere uma nova se o erro persistir, pois esta expira hoje!)
const KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
// =====================================================

const bancoTransacoes = new Map();

app.use(express.static(path.resolve())); 
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

// Formatadores para garantir que os dados sigam a regra da Vizzion
const formatCpf = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");

// ROTA 1: GERAÇÃO DO PIX
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        const valorFixo = parseFloat(valor) || 79.10; 
        const identifier = `ID${Date.now()}`; 

        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const dueDateStr = amanha.toISOString().split('T')[0];

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { 
                name: name || "Cliente", 
                email: email || "cliente@email.com", 
                phone: formatPhone(phone || "11999999999"), 
                document: formatCpf(cpf || "00000000000") 
            },
            products: [{
                id: "P1",
                name: "Taxa de Ativacao",
                quantity: 1,
                price: valorFixo
            }],
            dueDate: dueDateStr,
            metadata: { provider: "Checkout" },
            callbackUrl: "https://checkoutfinal.onrender.com/webhook" 
        };

        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        // 👉 TENTATIVA DE FORÇA BRUTA NOS HEADERS (A Vizzion vai aceitar um deles)
        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'Authorization': KEY,           // Sem o "Bearer" (Comum na Vizzion)
                'api-token': KEY,               // Outro formato comum
                'token': KEY,                   // Outro formato comum
                'Content-Type': 'application/json'
            }
        });

        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image,
            transactionId: identifier 
        });

    } catch (error: any) {
        return res.status(401).json({ 
            success: false, 
            message: `Erro Vizzion: ${JSON.stringify(error.response?.data || error.message)}` 
        });
    }
});

// ROTA 2: WEBHOOK
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

// ROTA 3: CHECK STATUS
app.get('/check-status/:id', (req, res) => {
    const id = req.params.id;
    const transacao = bancoTransacoes.get(id);
    if (transacao && transacao.status === 'paid') {
        return res.json({ paid: true }); 
    } else {
        return res.json({ paid: false }); 
    }
});

app.listen(process.env.PORT || 3000);
