import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔴 CHAVE VIZZION CONFIGURADA
const KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
// =====================================================

// Banco de dados em memória para monitorar o status das transações
const bancoTransacoes = new Map();

// SERVIR A PÁGINA VISUAL (Faz seu site aparecer no link do Render)
app.use(express.static(path.resolve())); 
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

// =====================================================
// ROTA 1: GERAR PIX (Lógica corrigida para evitar Erro 401)
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : ""; 
        const phoneLimpo = phone ? phone.replace(/\D/g, '') : "";
        const valorFixo = parseFloat(valor) || 79.10; 

        // ID único que o seu Front-end usará para consultar o status
        const identifier = `ID-${Date.now()}`; 

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { 
                name: name || "Cliente Consumidor", 
                email: email || "cliente@email.com", 
                document: cpfLimpo, 
                phone: phoneLimpo 
            },
            products: [{ 
                id: "TAXA_FINAL", 
                name: "Taxa de Liberação", 
                quantity: 1, 
                price: valorFixo 
            }],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
        };

        // Salva no banco como pendente antes de chamar a API
        bancoTransacoes.set(identifier, { status: 'pending', amount: valorFixo });

        // Chamada oficial para a Vizzion Pay
        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 
                'Authorization': `Bearer ${KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        return res.json({ 
            success: true, 
            payload: response.data.pix?.qrcode_text || response.data.qrcode_text || response.data.payload,
            encodedImage: response.data.pix?.qrcode_image || response.data.qrcode_image || response.data.encodedImage,
            transactionId: identifier 
        });

    } catch (error: any) {
        console.error("Erro na Vizzion:", error.response?.data || error.message);
        return res.json({ 
            success: false, 
            message: error.response?.data?.message || "Erro ao processar com a Vizzion Pay." 
        });
    }
});

// =====================================================
// ROTA 2: WEBHOOK (A Vizzion avisa aqui quando o cliente paga)
// =====================================================
app.post('/webhook', (req, res) => {
    const { transaction_id, identifier, status, payment_method, amount, event } = req.body;
    
    // A Vizzion pode enviar o nosso ID no campo 'identifier' ou 'transaction_id'
    const idBusca = identifier || transaction_id;

    console.log(`🔔 Notificação Recebida: ID ${idBusca} | Status: ${status} | Evento: ${event}`);

    // VALIDAÇÕES DE SEGURANÇA SOLICITADAS PELO SEU DEV:
    if (payment_method === 'PIX' && status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);
            
            // Valida se o valor pago é o mesmo que foi gerado
            if (Number(transacao.amount) === Number(amount)) {
                // ALTERA O STATUS PARA PAGO (Isso libera o redirecionamento no Front)
                bancoTransacoes.set(idBusca, { status: 'paid', amount: amount });
                console.log(`✅ STATUS ATUALIZADO: Transação ${idBusca} marcada como PAGA.`);
            }
        }
    }

    // Retorna OK para a Vizzion não enviar o aviso de novo
    return res.status(200).send("OK");
});

// =====================================================
// ROTA 3: CHECK STATUS (O Polling que faz a página pular)
// =====================================================
app.get('/check-status/:id', (req, res) => {
    const id = req.params.id;
    const transacao = bancoTransacoes.get(id);

    // Se o Webhook já mudou o status para 'paid', o Front-end recebe true e redireciona
    if (transacao && transacao.status === 'paid') {
        return res.json({ paid: true }); 
    } else {
        return res.json({ paid: false }); 
    }
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor 100% Operacional"));
