import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 SUA CHAVE VIZZION PAY
const KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
// =====================================================

// Banco de dados em memória para as transações
const bancoTransacoes = new Map();

// Faz o seu site aparecer quando acessam o link do Render
app.use(express.static(path.resolve())); 
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

// =====================================================
// ROTA 1: GERAÇÃO DO PIX
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        
        const valorFixo = parseFloat(valor) || 79.10; 
        const identifier = `ID${Date.now()}`; 

        // Data de vencimento (amanhã)
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        const dueDateStr = amanha.toISOString().split('T')[0];

        // Montagem do corpo conforme a documentação que você enviou
        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { 
                name: name || "Cliente", 
                email: email || "cliente@email.com", 
                phone: phone || "(11) 99999-9999", 
                document: cpf || "000.000.000-00" 
            },
            products: [{
                id: "i9peunj4hum4",
                name: "Taxa de Liberação",
                quantity: 1,
                price: valorFixo
            }],
            dueDate: dueDateStr,
            metadata: {},
            callbackUrl: "https://checkoutfinal.onrender.com/webhook" 
        };

        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        // Chamada para a Vizzion Pay com os dois formatos de Header mais usados
        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'Authorization': `Bearer ${KEY}`, // Formato 1
                'token': KEY,                     // Formato 2 (comum na Vizzion)
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image,
            transactionId: identifier 
        });

    } catch (error: any) {
        // Retorna o erro real para sabermos o que a Vizzion respondeu
        const msgErro = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        return res.status(error.response?.status || 500).json({ 
            success: false, 
            message: msgErro 
        });
    }
});

// =====================================================
// ROTA 2: WEBHOOK (RECEBE O AVISO DE PAGAMENTO)
// =====================================================
app.post('/webhook', (req, res) => {
    const { transaction_id, identifier, status, payment_method, amount, event } = req.body;
    
    // O ID pode vir em 'identifier' (o que nós criamos) ou 'transaction_id' (o deles)
    const idBusca = identifier || transaction_id;

    if (payment_method === 'PIX' && status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);
            if (Number(transacao.amount) === Number(amount)) {
                bancoTransacoes.set(idBusca, { status: 'paid', amount: amount });
                console.log(`✅ Pagamento confirmado para: ${idBusca}`);
            }
        }
    }
    return res.status(200).send("OK");
});

// =====================================================
// ROTA 3: CHECK STATUS (O SITE CONSULTA SE JÁ PAGOU)
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

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor Pronto"));
