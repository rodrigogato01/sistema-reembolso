import { Request, Response } from 'express';
import axios from 'axios';

export class PixController {
  async create(req: Request, res: Response) {
    try {
      const { name, cpf } = req.body;
      
      // SUA CHAVE DE PRODUÇÃO ASAAS
      const ASAAS_KEY = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjI0MDQ3YWIwLTMyMWQtNGI3Ni1iNDg3LWYzMWViNWI0N2JlMTo6JGFhY2hfMTU4YTE3MDctNTFkNy00ZmQ0LWI5MWQtZTFmZGY5YjMwNzVl";
      const ASAAS_URL = "https://www.asaas.com/api/v3";

      console.log(`[ASAAS] Iniciando geração para: ${name} | CPF: ${cpf}`);

      // 1. CRIAR OU LOCALIZAR CLIENTE
      const customerResponse = await axios.post(`${ASAAS_URL}/customers`, {
        name: name,
        cpfCnpj: cpf,
        notificationDisabled: true
      }, { 
        headers: { 'access_token': ASAAS_KEY } 
      });

      const customerId = customerResponse.data.id;

      // 2. CRIAR COBRANÇA PIX (R$ 37,90)
      const paymentResponse = await axios.post(`${ASAAS_URL}/payments`, {
        customer: customerId,
        billingType: "PIX",
        value: 37.90,
        dueDate: new Date().toISOString().split('T')[0],
        description: "Taxa de Liberação de Saldo",
        postalService: false
      }, { 
        headers: { 'access_token': ASAAS_KEY } 
      });

      const paymentId = paymentResponse.data.id;

      // 3. BUSCAR OS DADOS DO QR CODE (PARA MANTER DISSCRIÇÃO)
      // Esta rota retorna a imagem em Base64 e o código Copia e Cola
      const qrCodeResponse = await axios.get(`${ASAAS_URL}/payments/${paymentId}/pixQrCode`, {
        headers: { 'access_token': ASAAS_KEY }
      });

      console.log(`[ASAAS] Pix gerado com sucesso para pagamento: ${paymentId}`);

      // 4. RETORNO PARA O FRONT-END (ELEMENTOR)
      // Enviamos os dados para serem montados dentro do seu site
      return res.json({
        success: true,
        payload: qrCodeResponse.data.payload, // Texto do Copia e Cola
        encodedImage: qrCodeResponse.data.encodedImage, // Imagem em Base64
        paymentId: paymentId
      });

    } catch (error: any) {
      const errorDetail = error.response?.data || error.message;
      console.error("[ASAAS ERROR]:", JSON.stringify(errorDetail));
      
      return res.status(500).json({ 
        success: false, 
        message: "Erro ao processar pagamento",
        detail: errorDetail
      });
    }
  }

  // Rota de consulta de status (caso queira automatizar a liberação depois)
  async checkStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const ASAAS_KEY = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjI0MDQ3YWIwLTMyMWQtNGI3Ni1iNDg3LWYzMWViNWI0N2JlMTo6JGFhY2hfMTU4YTE3MDctNTFkNy00ZmQ0LWI5MWQtZTFmZGY5YjMwNzVl";

      const response = await axios.get(`https://www.asaas.com/api/v3/payments/${id}`, {
        headers: { 'access_token': ASAAS_KEY }
      });

      return res.json({ status: response.data.status }); // Retorna 'RECEIVED' se pago
    } catch (error) {
      return res.status(500).json({ error: "Erro ao consultar status" });
    }
  }

  // Webhook para receber confirmação automática da Asaas
  async webhook(req: Request, res: Response) {
    console.log("[WEBHOOK RECEIVED]:", req.body);
    // Aqui você pode colocar a lógica para disparar e-mail ou liberar o bônus
    return res.status(200).send("OK");
  }
}
