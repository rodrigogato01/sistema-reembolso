import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

const VIZZION_SECRET = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus';

app.post('/pix', async (req, res) => {
    try {
        let { valor, name, cpf } = req.body;

        // VALOR PADRÃO: Se o botão não mandar valor, cobra 27.90
        if (!valor) valor = "27.90";
        
        // DADOS PADRÃO: Se não tiver nome/cpf, usa genérico para garantir a geração
        if (!name) name = "Cliente Shopee";
        if (!cpf) cpf = "00000000000"; 
        const email = "cliente@pagamento.com";

        // Converte para centavos (Vizzion exige int)
        const amount = Math.round(parseFloat(valor) * 100);

        console.log(`Gerando Pix de R$ ${valor} para ${name}`);

        const response = await axios.post('https://api.vizzionpay.com/v1/transactions', {
            amount: amount,
            payment_method: 'pix',
            customer: {
                name: name,
                document: cpf.replace(/\D/g, ''),
                email: email,
                phone: "11999999999"
            }
        }, {
            headers: { 'Authorization': `Bearer ${VIZZION_SECRET}` }
        });

        const data = response.data;
        
        // Pega o código Copia e Cola e a Imagem (se houver)
        const payload = data.pix_code || data.qrcode_text || data.payload;
        const imagem = data.pix_qrcode || data.qrcode_image || data.encodedImage;

        return res.json({ success: true, payload: payload, encodedImage: imagem });

    } catch (error: any) {
        console.error("Erro Vizzion:", error.response?.data || error.message);
        return res.status(500).json({ success: false });
    }
});

// Rotas para servir seus HTMLs
app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));
app.get('/iof', (req, res) => res.sendFile(path.join(process.cwd(), 'iof.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
