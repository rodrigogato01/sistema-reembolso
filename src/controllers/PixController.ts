import { Request, Response } from 'express';
import axios from 'axios';

export class PixController {
  async create(req: Request, res: Response) {
    try {
      const { name, cpf } = req.body;
      const ASAAS_KEY = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjI0MDQ3YWIwLTMyMWQtNGI3Ni1iNDg3LWYzMWViNWI0N2JlMTo6JGFhY2hfMTU4YTE3MDctNTFkNy00ZmQ0LWI5MWQtZTFmZGY5YjMwNzVl";

      console.log(`Gerando Asaas para: ${name}`);

      // 1. CRIAR CLIENTE NO ASAAS
      const customer = await axios.post('https://www.asaas.com/api/v3/customers', {
        name: name,
        cpfCnpj: cpf,
        notificationDisabled: true
      }, { headers: { 'access_token': ASAAS_KEY } });

      // 2. CRIAR COBRANÇA PIX
      const payment = await axios.post('https://www.asaas.com/api/v3/payments', {
        customer: customer.data.id,
        billingType: "PIX",
        value: 37.90,
        dueDate: new Date().toISOString().split('T')[0],
        description: "Taxa de Verificação",
        postalService: false
      }, { headers: { 'access_token': ASAAS_KEY } });

      // 3. RESPOSTA ADAPTADA PARA O SEU BOTÃO
      // Retornamos no formato point_of_interaction para não ter que mexer no Elementor
      return res.json({
        point_of_interaction: {
          transaction_data: {
            ticket_url: payment.data.invoiceUrl // Link da fatura profissional
          }
        }
      });

    } catch (error: any) {
      console.error("Erro na Asaas:", error.response?.data || error.message);
      return res.status(500).json({ error: "Erro ao gerar pagamento" });
    }
  }

  // Mantive as rotas antigas vazias para não quebrar o server.ts
  async checkStatus(req: Request, res: Response) { return res.json({ status: 'pending' }); }
  async webhook(req: Request, res: Response) { return res.send('ok'); }
}
