import { Request, Response } from 'express';
import axios from 'axios';
import https from 'https';
import fs from 'fs';
import path from 'path';

export class PixController {
    private credentials = {
        client_id: 'SEU_CLIENT_ID_AQUI', // Pegue no painel da Efí acima do Secret
        client_secret: 'Client_Secret_1acd5546d4462972f9d5aae1c8dfee0c0bcddd8d',
        certificate: 'certificado.p12' // Nome que você deu ao arquivo
    };

    private getHttpsAgent() {
        const certPath = path.resolve(process.cwd(), this.credentials.certificate);
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

    create = async (req: Request, res: Response) => {
        try {
            const { name, cpf, valor } = req.body; 
            const token = await this.getAccessToken();

            // Criar a cobrança imediata
            const cob = await axios.post('https://pix.api.efipay.com.br/v2/cob', {
                calendario: { expiracao: 3600 },
                devedor: { cpf: cpf.replace(/\D/g, ''), nome: name },
                valor: { original: parseFloat(valor).toFixed(2) },
                chave: 'SUA_CHAVE_PIX_EFÍ', // Sua chave cadastrada na Efí
                solicitacaoPagador: 'Validação de Saldo Disponível'
            }, {
                headers: { Authorization: `Bearer ${token}` },
                httpsAgent: this.getHttpsAgent()
            });

            // Gerar o QR Code e o Copia e Cola
            const qrcode = await axios.get(`https://pix.api.efipay.com.br/v2/loc/${cob.data.loc.id}/qrcode`, {
                headers: { Authorization: `Bearer ${token}` },
                httpsAgent: this.getHttpsAgent()
            });

            return res.json({
                success: true,
                payload: qrcode.data.qrcode,
                encodedImage: qrcode.data.imagemQrcode
            });

        } catch (error: any) {
            console.error("ERRO EFÍ:", error.response?.data || error.message);
            return res.status(500).json({ success: false, message: "Erro ao processar Pix" });
        }
    }
}
