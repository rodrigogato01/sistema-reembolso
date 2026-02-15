import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 CHAVE VIZZION AQUI (GARANTA QUE ELA ESTÁ ATIVA NO PAINEL DELES)
const KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
// =====================================================

// "Banco de Dados" em memória para armazenar as transações geradas
const bancoTransacoes = new Map();

// =====================================================
// ROTA PARA APARECER O SEU SITE VISUAL
// =====================================================
app.use(express.static(path.resolve())); 

app.get('/', (req, res) => {
    // Exibe o arquivo HTML do site quando acessam a URL do Render
    res.sendFile(path.resolve('index.html'));
});

// =====================================================
// ROTA 1: GERA O PIX
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : ""; 
        const phoneLimpo = phone ? phone.replace(/\D/g, '') : "";
        const valorFixo = parseFloat(valor) || 27.90; 

        const identifier = `ID-${Date.now()}`; // ID Único da transação

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { name: name || "Cliente", email: email || "email@teste.com", document: cpfLimpo, phone: phoneLimpo },
            products: [{ id: "TAXA", name: "Taxa Liberacao", quantity: 1, price: valorFixo }],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
        };

        // SALVA A TRANSAÇÃO NO "BANCO" COMO PENDENTE (Como o Cauê pediu)
        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        // CHAMA A VIZZION PAY
        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'Authorization': `Bearer ${KEY}`, 
                'Content-Type': 'application/json' 
            }
        });

        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text || response.data.payload,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image || response.data.encodedImage,
            transactionId: identifier // Devolve o ID para o front fazer o polling
        });

    } catch (error: any) {
        // Se der erro de credencial, vai aparecer no log do Render e na tela
        console.error("Erro Vizzion:", error.response?.data || error.message);
        return res.json({ 
            success: false, 
            message: `Erro: ${error.response?.data?.message || error.message}` 
        });
    }
});

// =====================================================
// ROTA 2: O WEBHOOK (LÓGICA DO CAUÊ)
// =====================================================
app.post('/webhook', (req, res) => {
    const { transaction_id, identifier, status, payment_method, amount, event } = req.body;

    const idBusca = identifier || transaction_id;
    console.log(`🔔 Webhook Recebido - ID: ${idBusca} | Status: ${status} | Evento: ${event}`);

    // Validações que o Cauê pediu: PIX, COMPLETED e TRANSACTION_PAID
    if (payment_method === 'PIX' && status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        
        // Verifica se a transação existe no banco
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);
            
            // Verifica se o valor bate
            if (Number(transacao.amount) === Number(amount)) {
                // ATUALIZA O STATUS PARA PAGO
                bancoTransacoes.set(idBusca, { status: 'paid', amount: amount });
                console.log(`✅ Pagamento Confirmado e Atualizado: ${idBusca}`);
            } else {
                console.log(`❌ Erro: Valor divergente no webhook.`);
            }
        }
    }

    // Sempre responda 200 OK para o Gateway parar de enviar a notificação
    return res.status(200).send("OK");
});

// =====================================================
// ROTA 3: POLLING (O FRONT-END PERGUNTA A CADA 3 SEGUNDOS)
// =====================================================
app.get('/check-status/:id', (req, res) => {
    const id = req.params.id;
    const transacao = bancoTransacoes.get(id);

    // Se a transação existe e o Webhook já mudou para 'paid'
    if (transacao && transacao.status === 'paid') {
        return res.json({ paid: true }); // Isso faz o front redirecionar
    } else {
        return res.json({ paid: false }); // Continua esperando
    }
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor Vizzion rodando com Webhook e Página Ativa!"));
