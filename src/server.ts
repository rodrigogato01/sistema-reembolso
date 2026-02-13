import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// SUA SECRET KEY
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO TRANSAÇÃO V7 (CORREÇÃO ERRO 400)");

    try {
        let { valor, name, cpf, email } = req.body;

        // 1. DADOS PADRÃO (Para não travar)
        if (!valor) valor = "27.90";
        // Converte para Centavos (Inteiro) - EX: 2790
        const valorEmCentavos = Math.round(parseFloat(valor) * 100);

        // 2. TRATAMENTO DE DADOS DO CLIENTE
        // Remove tudo que não é número do CPF
        let cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';

        // Se CPF estiver vazio ou inválido, usa um genérico válido
        if (!cpfLimpo || cpfLimpo.length < 11) {
            cpfLimpo = "05350974033"; 
        }

        if (!name || name.length < 3) name = "Cliente Shopee";
        if (!email) email = "comprovante@pagamento.com";

        // GERA UM ID ÚNICO PARA A VENDA (Obrigatório para evitar erro 400 de duplicidade)
        const idUnico = `PEDIDO_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        console.log(`Enviando R$ ${valor} | CPF: ${cpfLimpo} | ID: ${idUnico}`);

        // 3. ENVIO PARA API (Estrutura Completa)
        const payloadVizzion = {
            amount: valorEmCentavos,
            payment_method: 'pix',
            external_id: idUnico, // <-- CAMPO NOVO IMPORTANTE
            customer: {
                name: name,
                document: cpfLimpo,
                email: email,
                phone: "5511999999999" // Com 55 e DDD
            },
            items: [
                {
                    title: "Taxa de Desbloqueio",
                    unit_price: valorEmCentavos,
                    quantity: 1,
                    tangible: false
                }
            ]
        };

        const response = await axios.post(API_URL, payloadVizzion, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 20000 
        });

        console.log("✅ VIZZION APROVOU:", response.status);

        const data = response.data;
        
        // Tenta pegar o código Pix em qualquer campo que eles devolvam
        const payloadPix = data.qr_code || data.pix_code || data.emv || data.payload;
        const imagemPix = data.qr_code_base64 || data.encodedImage || data.pix_qrcode;

        return res.json({ success: true, payload: payloadPix, encodedImage: imagemPix });

    } catch (error: any) {
        console.error("❌ FALHA NA REQUISIÇÃO:");
        
        if (error.response) {
            // Loga o erro exato que o banco devolveu no console do Render
            console.error(`Status: ${error.response.status}`);
            console.error(`Erro Detalhado: ${JSON.stringify(error.response.data)}`);
            
            // Retorna o motivo exato para o seu alerta na tela
            // Ex: "O campo 'document' é obrigatório"
            const msgErro = error.response.data.message || error.response.data.error || JSON.stringify(error.response.data);
            
            return res.json({ 
                success: false, 
                message: `Erro Vizzion (${error.response.status}): ${msgErro}` 
            });
        } else {
            return res.json({ success: false, message: "Erro de conexão com a API." });
        }
    }
});

// Rota Principal
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR V7 RODANDO NA PORTA ${PORT}`));
