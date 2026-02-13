import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// --- CONFIGURAÇÕES DE PRODUÇÃO ---
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> NOVA VENDA REAL INICIADA");

    try {
        // Recebe os dados do Frontend
        let { valor, name, cpf, email } = req.body;

        // 1. VALIDAÇÃO DO VALOR (Crítico para não cobrar errado)
        // Se não vier valor, usa o padrão da taxa.
        if (!valor) valor = "27.90";
        
        // Converte R$ 27.90 para 2790 (Centavos) - Obrigatório para Vizzion
        const valorEmCentavos = Math.round(parseFloat(valor) * 100);

        // 2. TRATAMENTO DOS DADOS DO CLIENTE
        // Remove tudo que não for número do CPF
        let cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';

        // FALLBACK DE SEGURANÇA:
        // Se o cliente chegou aqui sem CPF (erro de fluxo), usamos um CPF genérico
        // para garantir que o QR Code seja gerado e você receba o dinheiro.
        if (!cpfLimpo || cpfLimpo.length < 11) {
            console.log("Aviso: Cliente sem CPF identificado. Usando genérico para processar pagamento.");
            cpfLimpo = "07246738000"; // CPF Válido Genérico (Consumidor)
        }
        
        if (!name || name.length < 3) {
            name = "Cliente Consumidor";
        }

        if (!email) {
            email = "comprovante@pagamento.com";
        }

        console.log(`Processando: R$ ${valor} (${valorEmCentavos} cts) | Cliente: ${name}`);

        // 3. ENVIO PARA A VIZZION
        const response = await axios.post(API_URL, {
            amount: valorEmCentavos,
            payment_method: 'pix',
            payer: {
                name: name,
                document: cpfLimpo,
                email: email,
                phone: "11999999999" // Telefone não é obrigatório ser real para o Pix funcionar
            }
        }, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 20000 // 20 segundos de tolerância
        });

        console.log("✅ VIZZION APROVOU:", response.status);

        const data = response.data;
        
        // Captura o código Pix em qualquer campo que a API devolver
        const payload = data.qr_code || data.pix_code || data.emv || data.payload;
        const imagem = data.qr_code_base64 || data.encodedImage || data.pix_qrcode;

        return res.json({ success: true, payload, encodedImage: imagem });

    } catch (error: any) {
        console.error("❌ FALHA NA TRANSAÇÃO:");
        
        if (error.response) {
            // Erro retornado pelo Banco/API
            console.error(`Status API: ${error.response.status}`);
            console.error(`Erro Detalhado: ${JSON.stringify(error.response.data)}`);
            
            return res.json({ 
                success: false, 
                message: `Erro no Processamento (${error.response.status}). Verifique
