const payment = new Payment(client);
const refundClient = new PaymentRefund(client);

export class PixService {
    async createCharge(amount: number, name: string, cpf: string) {
        const cleanCpf = cpf.replace(/\D/g, '');
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
    }

    // Usamos 'any' para aceitar qualquer ID e não dar erro no Controller
    async checkStatus(id: any) {
        try {
            const response = await payment.get({ id: String(id) });
            return response.status; 
        } catch (error) { return 'error'; }
    }

    async refund(id: any) {
        try {
            await refundClient.create({
                body: { payment_id: String(id) }
            } as any);
            return true;
        } catch (error) { return false; }
    }
}
