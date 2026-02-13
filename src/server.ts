import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// --- BANCO DE DADOS TEMPORÁRIO (Memória) ---
// Aqui guardamos quem pagou. Em um sistema gigante, seria um banco SQL.
const transacoes: any = {};

const KEY = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus'.trim();

// 1. ROTA QUE GERA O PIX
app.post('/pix', async (req, res) => {
    console.log("--> Nova solicitação de PIX");

    const { valor, name, cpf, email, phone } = req.body;
    
    // Gera um ID único para essa transação
    const uniqueId = `ID-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const amountFloat = parseFloat(valor || 38.90);
    
    // Salva na memória como PENDENTE
    transacoes[uniqueId] = { 
        status: 'PENDING', 
        valor: amountFloat,
        criadoEm: new Date()
    };

    // Prepara dados para a Vizzion
    const payload = {
        identifier: uniqueId, // IMPORTANTE: Enviamos nosso ID para eles devolverem depois
        amount: amountFloat,
        client: {
            name: name || "Cliente Consumidor",
            email: email || "email@teste.com",
            phone: phone || "(11) 99999-9999",
            document: cpf || "05350974033"
        },
        products: [{ id: "TAXA-38", name: "Taxa", quantity: 1, price: amountFloat }],
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    };

    try {
        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' }
        });

        const data = response.data;
        let copyPaste = data.pix?.qrcode_text || data.qrcode_text || data.payload;
        let qrImage = data.pix?.qrcode_image || data.qrcode_image || data.encodedImage;

        // Retorna para o site o ID da transação também!
        return res.json({ 
            success: true, 
            payload: copyPaste, 
            encodedImage: qrImage, 
            transactionId: uniqueId // <--- O site precisa disso para monitorar
        });

    } catch (error: any) {
        console.error("Erro Vizzion:", error.response?.data || error.message);
        return res.json({ success: false, message: "Erro ao conectar." });
    }
});

// 2. ROTA DO WEBHOOK (A Vizzion chama isso quando pagam)
app.post('/webhook', (req, res) => {
    // O seu dev pediu para validar ID, Status, Valor e Evento.
    const { identifier, status, amount, event } = req.body;

    console.log(`🔔 Webhook recebido para: ${identifier} | Status: ${status}`);

    // Verifica se a transação existe na nossa memória
    if (transacoes[identifier]) {
        // Validação básica sugerida
        if (status === 'COMPLETED' || event === 'TRANSACTION_PAID') {
            transacoes[identifier].status = 'PAID';
            console.log(`✅ PAGAMENTO CONFIRMADO: ${identifier}`);
        }
        return res.status(200).send('OK');
    }

    return res.status(400).send('Transação não encontrada');
});

// 3. ROTA QUE O SEU SITE VAI FICAR CHAMANDO (Polling)
app.get('/check-status/:id', (req, res) => {
    const id = req.params.id;
    const transacao = transacoes[id];

    if (transacao && transacao.status === 'PAID') {
        return res.json({ paid: true });
    }
    return res.json({ paid: false });
});

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR COM WEBHOOK RODANDO NA PORTA ${PORT}`));
