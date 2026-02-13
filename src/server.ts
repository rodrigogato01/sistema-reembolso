import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
// Serve os arquivos estáticos (HTML, CSS)
app.use(express.static(process.cwd()));

// --- CONFIGURAÇÕES DE PRODUÇÃO ---
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> NOVA VENDA REAL INICIADA");

    try {
        // Recebe os dados do Frontend
        let { valor, name, cpf, email } = req.body;

        // 1. VALIDAÇÃO DO VALOR
        if (!valor) valor = "27.90";
        
        // Converte para Centavos (Inteiro)
        const valorEmCentavos = Math.round(parseFloat(valor) * 100);

        // 2. TRATAMENTO DOS DADOS
        let cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';

        // Fallback: Se não tiver CPF, usa um genérico válido para não perder a venda
        if (!cpfLimpo || cpfLimpo.length < 11) {
            console.log("Aviso: Cliente sem CPF. Usando genérico.");
            cpfLimpo = "07246738000"; 
        }
        
        if (!name || name.length < 3) {
            name = "Cliente Consumidor";
        }

        if (!email) {
            email = "comprovante@pagamento.com";
        }

        console.log(`Processando: R$ ${valor} | Cliente: ${name}`);

        // 3. ENVIO PARA A VIZZION
        const response = await axios.post(API_URL, {
            amount: valorEmCentavos,
            payment_method: 'pix',
            payer: {
                name: name,
                document: cpfLimpo,
                email: email,
                phone: "11999999999"
            }
        }, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 20000 
        });

        console.log("✅ VIZZION APROVOU:", response.status);

        const data = response.data;
        
        const payload = data.qr_code || data.pix_code || data.emv || data.payload;
        const imagem = data.qr_code_base64 || data.encodedImage || data.pix_qrcode;

        return res.json({ success: true, payload, encodedImage: imagem });

    } catch (error: any) {
        console.error("❌ FALHA NA TRANSAÇÃO:");
        
        if (error.response) {
            console.error(`Status API: ${error.response.status}`);
            console.error(`Erro Detalhado: ${JSON.stringify(error.response.data)}`);
            
            return res.json({ 
                success: false, 
                message: `Erro no Processamento (${error.response.status}). Verifique os dados.` 
            });
        } else {
            console.error(error.message);
            return res.json({ success: false, message: "Erro de comunicação com o gateway." });
        }
    }
});

// Rota para servir a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR DE PRODUÇÃO RODANDO NA PORTA ${PORT}`));
