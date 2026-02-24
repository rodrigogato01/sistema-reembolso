import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🔑 CONFIGURAÇÕES
// =====================================================
const MK_API_URL = "memberkit.com.br/api/v1/users"; 
const MK_CLASSROOM_ID = 275575; 
const MK_KEY = "G3gAuabnX5b3X9cs7oQ8aidn"; 

const PUBLIC_KEY = "rodrigo-igp_9mdb0v11ivwyoqtt"; 
const SECRET_KEY = "2z9x2whgofky0aneyx1pu0dkaj8y9j0m8981yitu81wdb75lrirj1u2b50xiqacf"; 

const META_PIXEL_ID = "847728461631550"; 
const META_ACCESS_TOKEN = "EAAGZAoNPRbbwBQlVq2XIPxcm6S3lE7EHASXNsyQoiULVOBES9uwoBt1ijXLIsS19daREz2xzuLnMl0C1yZAE3HYkKK19Fmykttzdhs5qZCZC0TkCviGXSrS9NuGvb99ZBDYZB8dkEzjlp6sZBrnG8x79dvvpV55mDhVXTocILMBbuxZCASrUZCIdUr18mYTZB0fgZDZD";

const bancoTransacoes = new Map();

// 🔎 FUNÇÃO MESTRA: Encontra o código Pix
function acharCopiaECola(obj: any): string | null {
    if (typeof obj === 'string' && obj.includes('000201')) return obj;
    if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            const result = acharCopiaECola(obj[key]);
            if (result) return result;
        }
    }
    return null;
}

function maskLog(data: string): string {
    if (!data) return '';
    if (data.includes('@')) return data.split('@')[0].slice(0, 3) + '***@' + data.split('@')[1];
    return data.slice(0, 3) + '***';
}

function hashData(data: string): string {
    if (!data) return '';
    return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

app.use(express.static(path.join(__dirname, '..'))); 
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, '..', 'index.html')); });

// -----------------------------------------------------
// 🚀 ROTA PIX: RASTREIO NATIVO NO IDENTIFIER
// -----------------------------------------------------
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor, origem } = req.body;
        
        // "Carimbo" da influenciadora no ID da VizzionPay
        const influNome = (origem || "DIRETO").toUpperCase().slice(0, 10);
        const identifier = `${influNome}_ID${Date.now()}`;
        
        bancoTransacoes.set(identifier, { 
            status: 'pending', 
            emailCliente: email, 
            nomeCliente: name,
            origem: influNome 
        });

        const payload = {
            identifier: identifier, // 👈 Isso aparece na sua notificação do celular
            amount: parseFloat(valor) || 27.90,
            client: { name, email, document: (cpf || "").replace(/\D/g, ''), phone: (phone || "").replace(/\D/g, '') },
            products: [{ 
                id: "TAXA_01", 
                name: `Liberação [${influNome}]`, 
                quantity: 1, 
                price: parseFloat(valor) || 27.90 
            }],
            // 💰 DIVISÃO ORIGINAL: 50% para o sócio fixo
            splits: [{ 
                producerId: "cmg7bvpns00u691tsx9g6vlyp", 
                amount: parseFloat(((parseFloat(valor) || 27.90) * 0.5).toFixed(2)) 
            }],
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'x-public-key': PUBLIC_KEY, 'x-secret-key': SECRET_KEY, 'Content-Type': 'application/json' }
        });

        const pixCopiaECola = acharCopiaECola(response.data);
        console.log(`✅ PIX GERADO: ${identifier}`);
        
        return res.json({ success: true, payload: pixCopiaECola, transactionId: identifier });
    } catch (error: any) { 
        return res.status(401).json({ success: false }); 
    }
});

// -----------------------------------------------------
// 💰 WEBHOOK: NOTIFICAÇÃO E ATIVAÇÃO
// -----------------------------------------------------
// -----------------------------------------------------
// 💰 WEBHOOK ATUALIZADO (RASTREIO À PROVA DE FALHAS)
// -----------------------------------------------------
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;

    // Validamos se o evento é de pagamento aprovado
    if (transaction?.status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        
        const idBusca = transaction.identifier || transaction.id || "";
        const memoria = bancoTransacoes.get(idBusca) || {};
        
        const nomeCliente = transaction.client?.name || memoria.nomeCliente || "Cliente Shopee";
        const emailCliente = transaction.client?.email || memoria.emailCliente;

        // 🎯 LÓGICA DE RESGATE: Se não estiver na memória, tenta ler do próprio ID
        // Isso evita que apareça "DIRETO" se a rota /pix falhou antes.
        const influ = memoria.origem || idBusca.split('_ID')[0] || "DIRETO";

        if (emailCliente) {
            bancoTransacoes.set(idBusca, { ...memoria, status: 'paid' });

            // Esse log agora sempre mostrará a influenciadora enviada no ID
            console.log(`💰 VENDA APROVADA! | ORIGEM: ${influ.toUpperCase()} | CLIENTE: ${maskLog(emailCliente)}`);

            const mkPayload = {
                "api_key": MK_KEY,
                "full_name": nomeCliente,
                "email": emailCliente,
                "status": "active",
                "classroom_ids": [MK_CLASSROOM_ID]
            };

            try {
                await axios.post(`https://${MK_API_URL}`, mkPayload, {
                    headers: { "Content-Type": "application/json", "Accept": "application/json" }
                });
            } catch (err: any) {}

            axios.post(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
                data: [{
                    event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), action_source: "website",
                    user_data: { em: [hashData(emailCliente)], fn: [hashData(nomeCliente)] },
                    custom_data: { value: Number(transaction.amount), currency: "BRL" }
                }],
                access_token: META_ACCESS_TOKEN
            }).catch(() => {});
            
            axios.get('https://api.pushcut.io/KnUVBiCa-4A0euJ42eJvj/notifications/MinhaNotifica%C3%A7%C3%A3o').catch(() => {});
            axios.get('https://api.pushcut.io/g8WCdXfM9ImJ-ulF32pLP/notifications/Minha%20Primeira%20Notifica%C3%A7%C3%A3o').catch(() => {});
        }
    }
    return res.status(200).send("OK");
});
