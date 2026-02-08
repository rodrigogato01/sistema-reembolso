import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';

// Configuração do Mercado Pago
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
            const request = await payment.create({
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
            return request;
        } catch (error) {
            console.error("Erro MP:", error);
            throw new Error("Falha ao criar PIX");
        }
    }

    // 2. Verificar Status (AGORA ACEITA TEXTO E NÚMERO)
    async checkStatus(id: string | number) {
        try {
            // Convertemos para string aqui dentro para o Mercado Pago não reclamar
            const response = await payment.get({ id: String(id) });
            return response.status; 
        } catch (error) {
            return 'error';
        }
    }

    // 3. Fazer Reembolso (AGORA ACEITA TEXTO E NÚMERO)
    async refund(id: string | number) {
        try {
            console.log(`Processando estorno para ID: ${id}`);
            await refundClient.create({
                body: {
                    payment_id: String(id) // Garante que é texto
                }
            } as any);
            return true;
        } catch (error) {
            console.error("Erro no estorno:", error);
            return false;
        }
    }
}