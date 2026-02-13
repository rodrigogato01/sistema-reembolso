import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
// Serve os arquivos estáticos
app.use(express.static(process.cwd()));

// CONFIGURAÇÕES DE PRODUÇÃO
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';
const API_URL = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

app.post('/pix', async (req, res) => {
    console.log("--> NOVA TRANSAÇÃO INICIADA");

    try {
        let { valor, name, cpf, email } = req.body;

        // 1. VALIDAÇÃO DO VALOR
        if (!valor) valor = "27.90";
        // Converte 27.90 para 2790 (Inteiro/Centavos)
        const valorEmCentavos = Math.round(parseFloat(valor) * 100);

        // 2. TRATAMENTO DE DADOS
        let cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '';

        // Fallback: Se o CPF vier vazio ou inválido, usa um de teste para não travar
        // (Em produção real, isso garante que o cliente veja o Pix mesmo se digitou algo errado antes)
        if (!cpfLimpo || cpfLimpo.length < 11) {
            console.log("Aviso: CPF inválido ou vazio. Usando genérico.");
            cpfLimpo = "05350974033"; 
        }

        if (!name || name.length < 3) name = "Cliente Consumidor";
        if (!email) email = "cliente@pagamento.com";

        console.log(`Enviando R$ ${valor} (${valorEmCentavos} cts) para a Vizzion...`);

        // 3. ENVIO PARA API
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

        console.log("✅ VIZZION RESPOSTA:", response.status);

        const data = response.data;
        
        // Pega o payload (Copia e Cola)
        // A Vizzion pode devolver como 'qr_code', 'pix_code', 'payload' ou 'emv'
        const payload = data.qr_code || data.pix_code || data.emv || data.payload;
        
        // Pega a imagem (Base64)
        const imagem = data.qr_code_base64 || data.encodedImage || data.pix_qrcode;

        return res.json({ success: true, payload: payload, encodedImage: imagem });

    } catch (error: any) {
        console.error("❌ FALHA NA REQUISIÇÃO:");
        
        if (error.response) {
            // Loga o erro exato que o banco devolveu (ajuda a descobrir se é CPF ou Valor)
            console.error(`Status: ${error.response.status}`);
            console.error(`Erro: ${JSON.stringify(error.response.data)}`);
            
            return res.json({ 
                success: false, 
                message: `Erro do Banco (${error.response.status}). Verifique os dados.` 
            });
        } else {
            console.error(error.message);
            return res.json({ success: false, message: "Erro de conexão com a API." });
        }
    }
});

// Rota Principal
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR RODANDO NA PORTA ${PORT}`));
