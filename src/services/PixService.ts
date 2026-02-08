import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN || '', 
    options: { timeout: 5000 }
});

const payment = new Payment(client);
const refundClient = new PaymentRefund(client);

export class PixService {
    
    // 1. Criar PIX
    async createCharge(amount: number, name: string, cpf: string) {
        const cleanCpf = cpf.replace(/\D/g, '');
        try {
            return await payment.create({
                body: {
                    transaction_amount: amount,
                    description: `Venda - ${name}`,
                    payment_method_id: 'pix',
                    payer: {
                        email: 'cliente@email.com',
                        first_name: name,
                        identification: { type: 'CPF', number: cleanCpf }
                    }
                }
            });
        } catch (error) {
            throw new Error("Falha no Mercado Pago");
        }
    }

    // 2. Verificar Status (AGORA ACEITA TUDO: any)
    async checkStatus(id: any) {
        try {
            // AQUI ESTÁ A MÁGICA: Convertemos qualquer coisa para string na marra
            const idString = String(id);
            const response = await payment.get({ id: idString });
            return response.status; 
        } catch (error) {
            return 'error';
        }
    }

    // 3. Estornar (AGORA ACEITA TUDO: any)
    async refund(id: any) {
        try {
            const idString = String(id);
            console.log(`Estornando ID: ${idString}`);
            await refundClient.create({
                body: { payment_id: idString }
            } as any);
            return true;
        } catch (error) {
            return false;
        }
    }
}