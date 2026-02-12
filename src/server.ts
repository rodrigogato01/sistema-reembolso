import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// SUA SECRET KEY DA VIZZION
const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';

app.post('/pix', async (req, res) => {
    try {
        // Recebe os dados, mas se faltar algo, preenche com genérico para não perder a venda
        let { name, cpf, email, phone, valor } = req.body;

        // Tratamento de segurança (Defaults)
        if (!name || name.length < 3) name = "Cliente Shopee";
        if (!email) email = "cliente@pagamento.com";
        // Remove tudo que não é número do CPF
        const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : '00000000000'; 
        
        console.log(`Gerando Pix Vizzion (${valor}): ${name} - ${cpfLimpo}`);

        // Converte valor para centavos (Ex: 27.90 -> 2790)
        const valorCentavos = Math.round(parseFloat(valor) * 100);

        const response = await axios.post('https://api.vizzionpay.com/v1/transactions', {
            amount: valorCentavos,
            payment_method: 'pix',
            customer: {
                name: name,
                document: cpfLimpo,
                email: email,
                phone: phone ? phone.replace(/\D/g, '') : '11999999999'
            },
            postback_url: 'https://checkout-pix-profissional.onrender.com/webhook'
        }, {
            headers: {
                'Authorization': `Bearer ${VIZZION_SECRET}`,
                'Content-Type': 'application/json'
            }
        });

        const data = response.data;
        
        // Vizzion retorna o Copia e Cola em campos variados dependendo da versão
        const payload = data.pix_code || data.qrcode_text || data.payload || "Erro ao obter código";
        const imagem = data.pix_qrcode || data.qrcode_image || data.encodedImage;

        return res.json({ success: true, payload: payload, encodedImage: imagem });

    } catch (error: any) {
        console.error("Erro Vizzion:", error.response?.data || error.message);
        // Mesmo com erro, não mostramos tela branca pro cliente, retornamos erro tratado
        return res.json({ success: false, message: "Erro na comunicação com o banco." });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));
app.get('/iof', (req, res) => res.sendFile(path.join(process.cwd(), 'iof.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
