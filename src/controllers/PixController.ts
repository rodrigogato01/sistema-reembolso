import { Request, Response } from 'express';
import axios from 'axios';

export class PixController {
  // SUA CHAVE DE PRODUÇÃO ASAAS
  private ASAAS_KEY = "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjI0MDQ3YWIwLTMyMWQtNGI3Ni1iNDg3LWYzMWViNWI0N2JlMTo6JGFhY2hfMTU4YTE3MDctNTFkNy00ZmQ0LWI5MWQtZTFmZGY5YjMwNzVl";
  private ASAAS_URL = "https://www.asaas.com/api/v3";

  // 1. CRIA O PIX PARA O CLIENTE PAGAR (R$ 37,90)
  async create(req: Request, res: Response) {
    try {
      const { name, cpf, key_type } = req.body; // key_type é o tipo da chave (cpf, email, phone, etc)
      
      console.log(`[CRIANDO] Cliente: ${name} | Chave Pix de retorno: ${cpf}`);

      // Cria cliente na Asaas
      const customer = await axios.post(`${this.ASAAS_URL}/customers`, {
        name: name,
        cpfCnpj: cpf,
        notificationDisabled: true
      }, { headers: { 'access_token': this.ASAAS_KEY } });

      // Cria a cobrança
      const payment = await axios.post(`${this.ASAAS_URL}/payments`, {
        customer: customer.data.id,
        billingType: "PIX",
        value: 37.90, // Valor da taxa que ele paga
        dueDate: new Date().toISOString().split('T')[0],
        description: "Taxa de Verificação",
        // TRUQUE: Salvamos a chave pix dele aqui para usar na devolução
        externalReference: JSON.stringify({ chave: cpf, tipo: key_type || 'CPF' }), 
        postalService: false
      }, { headers: { 'access_token': this.ASAAS_KEY } });

      // Pega o QR Code
      const qrData = await axios.get(`${this.ASAAS_URL}/payments/${payment.data.id}/pixQrCode`, {
        headers: { 'access_token': this.ASAAS_KEY }
      });

      return res.json({
        success: true,
        payload: qrData.data.payload,
        encodedImage: qrData.data.encodedImage
      });

    } catch (error: any) {
      console.error("Erro Create:", error.response?.data || error.message);
      return res.status(500).json({ error: "Erro ao gerar cobrança" });
    }
  }

  // 2. O GATILHO: RECEBE O AVISO E DEVOLVE O DINHEIRO
  webhook = async (req: Request, res: Response) => {
    try {
      const { event, payment } = req.body;

      // Só nos interessa quando o pagamento é CONFIRMADO
      if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        
        console.log(`[WEBHOOK] Pagamento ${payment.id} confirmado! Iniciando devolução...`);

        // Recupera a chave pix que salvamos na criação
        let dadosRetorno;
        try {
            dadosRetorno = JSON.parse(payment.externalReference);
        } catch (e) {
            // Se der erro, tenta usar o CPF do cadastro como chave
            dadosRetorno = { chave: payment.cpfCnpj, tipo: 'CPF' };
        }

        // ====================================================
        // AQUI ACONTECE A DEVOLUÇÃO (TRANSFERÊNCIA PIX)
        // ====================================================
        try {
            const transfer = await axios.post(`${this.ASAAS_URL}/transfers`, {
                value: 1489.38, // VALOR QUE VAI VOLTAR PARA O CLIENTE (Prêmio)
                pixAddressKey: dadosRetorno.chave,
                pixAddressKeyType: this.detectarTipoChave(dadosRetorno.chave, dadosRetorno.tipo),
                description: "Saque Liberado - Recompensa",
                operationType: 'PIX'
            }, { 
                headers: { 'access_token': this.ASAAS_KEY } 
            });
            
            console.log(`[SUCESSO] Devolução de R$ 1.489,38 realizada para ${dadosRetorno.chave}`);
        } catch (transferError: any) {
             console.error("[ERRO TRANSFERÊNCIA]:", transferError.response?.data || transferError.message);
             // Dica: Se der erro de saldo insuficiente, o Asaas avisa aqui
        }
      }

      return res.status(200).json({ received: true });

    } catch (error) {
      console.error("Erro Webhook:", error);
      return res.status(500).json({ error: "Erro interno webhook" });
    }
  }

  // Função auxiliar para garantir o tipo da chave correto na Asaas
  detectarTipoChave(chave: string, tipoInformado: string) {
      if (tipoInformado === 'email' || chave.includes('@')) return 'EMAIL';
      if (tipoInformado === 'telefone' || (chave.length >= 10 && chave.length <= 12)) return 'PHONE';
      if (tipoInformado === 'aleatoria' || chave.length > 20) return 'EVP';
      return 'CPF'; // Padrão
  }

  // Check Status placeholder
  async checkStatus(req: Request, res: Response) { return res.json({ status: 'active' }); }
}
