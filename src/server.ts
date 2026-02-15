import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 CHAVE VIZZION AQUI
const KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
// =====================================================

const bancoTransacoes = new Map();

app.use(express.static(path.resolve())); 
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

// Formatadores obrigatórios da documentação
function formatCpf(cpf: string) {
    const v = cpf.replace(/\D/g, '');
    if (v.length === 11) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    return cpf;
}

function formatPhone(phone: string) {
    const v = phone.replace(/\D/g, '');
    if (v.length === 11) return v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    if (v.length === 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    return phone;
}

// =====================================================
// ROTA 1: GERA O PIX
// =====================================================
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
                name: name || "Cliente Consumidor", 
                email: email || "email@pendente.com", 
                phone: formatPhone(phone || "11999999999"), 
                document: formatCpf(cpf || "00000000000") 
            },
            products: [{ id: "TAXA_FINAL", name: "Taxa de Ativacao", quantity: 1, price: valorFixo }],
            dueDate: dueDateStr,
            metadata: {},
            callbackUrl: "https://checkoutfinal.onrender.com/webhook" 
        };

        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        // 👉 AQUI ESTÁ A CORREÇÃO: Enviando a chave em todos os formatos possíveis para a Vizzion achar.
        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'Authorization': `Bearer ${KEY}`, 
                'token': KEY,
                'api-key': KEY,
                'x-api-key': KEY,
                'Content-Type': 'application/json' 
            }
        });

        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text || response.data.payload,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image || response.data.encodedImage,
            transactionId: identifier 
        });

    } catch (error: any) {
        const erroReal = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        console.error("Erro Vizzion:", erroReal);
        return res.json({ success: false, message: `Detalhe do erro Vizzion: ${erroReal}` });
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

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor Rodando!"));
