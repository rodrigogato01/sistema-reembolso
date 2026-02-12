import { Request, Response } from 'express';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

export class PixController {
    // Credenciais EXATAS que você me passou
    private credentials = {
        client_id: 'Client_Id_4f08f7745e963684c33300837f59e4b3f852e645',
        client_secret: 'Client_Secret_1acd5546d4462972f9d5aae1c8dfee0c0bcddd8d',
        // O nome do arquivo tem que ser IGUAL ao que está na raiz do projeto
        certificate: 'producao-875882-Shopee Bônus.p12' 
    };

    private getHttpsAgent() {
        // Procura o arquivo na raiz do projeto
        const certPath = path.resolve(process.cwd(), this.credentials.certificate);
        
        if (!fs.existsSync(certPath)) {
            console.error(`ERRO CRÍTICO: Certificado não encontrado em: ${certPath}`);
            throw new Error(`Certificado não encontrado. Verifique se o arquivo .p12 está na raiz.`);
        }
        
        const cert = fs.readFileSync(certPath);
        return new https.Agent({ pfx: cert, passphrase: '' });
    }

    private async getAccessToken() {
        const auth = Buffer.from(`${this.credentials.client_id}:${this.credentials.client_secret}`).toString('base64');
        const response = await axios.post('https://pix.api.efipay.com.br/oauth/token', 
            { grant_type: 'client_credentials' },
            {
                headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
                httpsAgent: this.getHttpsAgent()
            }
        );
        return response.data.access_token;
    }

    // 1. CRIAR PIX
    create = async (req: Request, res: Response) => {
        try {
            const { name, cpf, valor } = req.body;
            const token = await this.getAccessToken();

            const cob = await axios.post('https://pix.api.efipay.com.br/v2/cob', {
                calendario: { expiracao: 3600 },
                devedor: { cpf: cpf.replace(/\D/g, ''), nome: name },
                valor: { original: parseFloat(valor).toFixed(2) },
                chave: 'e0cfba23-ddcb-441f-809d-893ccf6d0f7a', // Sua chave Pix
                solicitacaoPagador: 'Taxa de Servico'
            }, {
                headers: { Authorization: `Bearer ${token}` },
                httpsAgent: this.getHttpsAgent()
            });

            const qrcode = await axios.get(`https://pix.api.efipay.com.br/v2/loc/${cob.data.loc.id}/qrcode`, {
                headers: { Authorization: `Bearer ${token}` },
                httpsAgent: this.getHttpsAgent()
            });

            return res.json({
                success: true,
                payload: qrcode.data.qrcode,
                encodedImage: qrcode.data.imagemQrcode,
                txid: cob.data.txid
            });
        } catch (error: any) {
            console.error("Erro Efí:", error.response?.data || error.message);
            return res.status(500).json({ success: false });
        }
    }

    // 2. CHECK STATUS (Obrigatório para corrigir o erro TS2339)
    checkStatus = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const token = await this.getAccessToken();
            
            const response = await axios.get(`https://pix.api.efipay.com.br/v2/cob/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
                httpsAgent: this.getHttpsAgent()
            });

            return res.json({ status: response.data.status });
        } catch (error: any) {
            return res.status(500).json({ error: "Erro ao consultar status" });
        }
    }

    // 3. WEBHOOK (Obrigatório para corrigir o erro TS2339)
    webhook = async (req: Request, res: Response) => {
        console.log("Webhook recebido");
        return res.status(200).send("OK");
    }
}
