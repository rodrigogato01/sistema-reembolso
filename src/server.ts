import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// SUA SECRET KEY (Confirme se é esta mesma no seu painel)
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';

// TENTATIVA DE URLS (Se uma falhar, tente alterar aqui)
// Opções comuns: 'https://api.vizzionpay.com/v1', 'https://api.vizzionpay.com.br/v1', 'https://app.vizzionpay.com/api/v1'
const API_URL = 'https://api.vizzionpay.com/v1/transactions'; 

app.post('/pix', async (req, res) => {
    try {
        let { valor, name, cpf } = req.body;

        // DADOS PADRÃO (Para garantir que a venda não trave)
        if (!valor) valor = "27.90";
        if (!name) name = "Cliente Resgate";
        if (!cpf) cpf = "00000000000"; 
        
        // Remove caracteres especiais
        const cpfLimpo = cpf.replace(/\D/g, '');
        const valorCentavos = Math.round(parseFloat(valor) * 100);

        console.log(`[INFO] Tentando gerar Pix na Vizzion...`);
        console.log(`[INFO] URL: ${API_URL}`);
        console.log(`[INFO] Valor: ${valorCentavos} centavos`);

        const response = await axios.post(API_URL, {
            amount: valorCentavos,
            payment_method: 'pix',
            customer: {
                name: name,
                document: cpfLimpo,
                email: "cliente@email.com",
                phone: "11999999999"
            }
        }, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 segundos para não travar
        });

        const data = response.data;
        console.log("[SUCESSO] Resposta da Vizzion recebida!");

        // Tenta encontrar o código e a imagem em vários formatos possíveis
        const payload = data.pix_code || data.qrcode_text || data.payload || data.emv || "";
        const imagem = data.pix_qrcode || data.qrcode_image || data.encodedImage || data.qr_code_base64 || "";

        return res.json({ success: true, payload: payload, encodedImage: imagem });

    } catch (error: any) {
        // AQUI ESTÁ O SEGREDO: LOGA O ERRO PARA VOCÊ VER NO RENDER
        console.error("❌ ERRO AO CONECTAR NA VIZZION:");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error(`Dados: ${JSON.stringify(error.response.data)}`);
            
            // Se der erro 404, avisa que a URL está errada
            if(error.response.status === 404) {
                return res.json({ success: false, message: "Erro 404: A URL da API da Vizzion mudou. Verifique a documentação." });
            }
            // Se der erro 401, avisa que a Chave está errada
            if(error.response.status === 401) {
                return res.json({ success: false, message: "Erro 401: Chave de API inválida." });
            }
        } else {
            console.error(`Erro: ${error.message}`);
        }
        
        return res.json({ success: false, message: "Falha na conexão com a Vizzion. Veja os logs do Render." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));
app.get('/iof', (req, res) => res.sendFile(path.join(process.cwd(), 'iof.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
