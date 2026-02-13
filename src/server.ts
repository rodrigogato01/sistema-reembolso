import express from 'express';
import cors from 'cors';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(process.cwd()));

// SUA CHAVE
const KEY = 'e08f7qe1x8zjbnx4dkra9p8v7uj1wfacwidsnnf4lhpfq3v8oz628smahn8g6kus'.trim();

app.post('/pix', async (req, res) => {
    console.log("--> INICIANDO TRANSAÇÃO (V19 - DUPLA TENTATIVA INTELIGENTE)");

    const { valor, name, cpf, email, phone } = req.body;
    
    // 1. PREPARA OS DADOS
    const amountFloat = parseFloat(valor || 27.90);
    const uniqueId = `ID-${Date.now()}`;
    
    // Tenta usar o CPF do cliente (apenas números)
    let cpfCliente = cpf ? cpf.replace(/\D/g, '') : "";
    
    // Se o cliente não mandou CPF (ex: mandou chave de email), usa um genérico logo de cara
    if (cpfCliente.length !== 11) {
        console.log("Aviso: CPF do cliente inválido ou vazio. Usando gerado.");
        cpfCliente = gerarCpfValido();
    }

    // Função para montar o Payload (para podermos reutilizar)
    const montarPayload = (cpfParaEnviar: string) => ({
        identifier: uniqueId,
        amount: amountFloat,
        client: {
            name: name || "Cliente Consumidor",
            email: email || "comprovante@pagamento.com",
            phone: phone || "(11) 99999-9999",
            document: cpfParaEnviar
        },
        products: [{ id: "ZG14WV9", name: "Taxa", quantity: 1, price: amountFloat }],
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0]
    });

    // URL DA API (App costuma ser a correta para produção)
    const URL_API = 'https://app.vizzionpay.com/api/v1/gateway/pix/receive';

    try {
        // --- TENTATIVA 1: CPF REAL DO CLIENTE ---
        console.log(`Tentativa 1: CPF do Cliente (${cpfCliente})`);
        
        const response = await axios.post(URL_API, montarPayload(cpfCliente), {
            headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
            timeout: 10000
        });

        console.log("✅ SUCESSO DE PRIMEIRA!");
        return enviarResposta(res, response.data);

    } catch (error: any) {
        const status = error.response?.status;
        console.log(`❌ Falha na Tentativa 1 (Status: ${status})`);

        // SE O ERRO FOR 422 (CPF INVÁLIDO) ou 400 (DADOS), TENTA DE NOVO COM CPF GERADO
        if (status === 422 || status === 400) {
            console.log("⚠️ CPF do cliente foi recusado pela Vizzion. Tentando com CPF Coringa para salvar a venda...");
            
            try {
                // --- TENTATIVA 2: CPF CORINGA (VALIDADO) ---
                const cpfCoringa = gerarCpfValido();
                console.log(`Tentativa 2: CPF Coringa (${cpfCoringa})`);
                
                const response2 = await axios.post(URL_API, montarPayload(cpfCoringa), {
                    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
                    timeout: 10000
                });

                console.log("✅ SUCESSO NA SEGUNDA TENTATIVA!");
                return enviarResposta(res, response2.data);

            } catch (err2: any) {
                // Se falhar de novo, aí é erro de conexão ou chave
                console.error("❌ Erro Definitivo:", err2.response?.data);
                return res.json({ success: false, message: "Erro ao gerar PIX. Tente novamente." });
            }
        } else {
            // Se for outro erro (ex: 401 Chave Inválida, 500 Servidor Fora), não adianta tentar de novo
            const msg = error.response?.data?.message || "Erro de Conexão";
            return res.json({ success: false, message: `Erro Vizzion: ${msg}` });
        }
    }
});

// Função Auxiliar para extrair o QR Code da resposta
function enviarResposta(res: any, data: any) {
    let copyPaste = "";
    let qrImage = "";
    if (data.pix) {
        copyPaste = data.pix.qrcode_text || data.pix.payload;
        qrImage = data.pix.qrcode_image || data.pix.base64;
    } else {
        copyPaste = data.qrcode_text || data.pix_code;
        qrImage = data.qrcode_image || data.encodedImage;
    }
    return res.json({ success: true, payload: copyPaste, encodedImage: qrImage });
}

// Função Geradora de CPF Válido (Matemática Oficial)
function gerarCpfValido() {
    const rnd = (n: number) => Math.round(Math.random() * n);
    const mod = (dividend: number, divisor: number) => Math.round(dividend - (Math.floor(dividend / divisor) * divisor));
    const n1 = rnd(9), n2 = rnd(9), n3 = rnd(9), n4 = rnd(9), n5 = rnd(9), n6 = rnd(9), n7 = rnd(9), n8 = rnd(9), n9 = rnd(9);
    let d1 = n9 * 2 + n8 * 3 + n7 * 4 + n6 * 5 + n5 * 6 + n4 * 7 + n3 * 8 + n2 * 9 + n1 * 10;
    d1 = 11 - (mod(d1, 11)); if (d1 >= 10) d1 = 0;
    let d2 = d1 * 2 + n9 * 3 + n8 * 4 + n7 * 5 + n6 * 6 + n5 * 7 + n4 * 8 + n3 * 9 + n2 * 10 + n1 * 11;
    d2 = 11 - (mod(d2, 11)); if (d2 >= 10) d2 = 0;
    return `${n1}${n2}${n3}${n4}${n5}${n6}${n7}${n8}${n9}${d1}${d2}`;
}

app.get('/', (req, res) => res.sendFile(path.join(process.cwd(), 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SERVIDOR V19 (DOUBLE TAP) RODANDO NA PORTA ${PORT}`));
