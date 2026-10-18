# Verificador de números WhatsApp (ContactoCheck)

## Executar

- Comando: `npm start`
- O servidor serve a interface e a API nativa utilizando o próprio motor de verificação.

## Verificação própria com Blindagem Anti-Banimento

- O sistema utiliza o seu próprio motor interno conectado diretamente ao WhatsApp (via QR Code ou Código de Emparelhamento de 8 dígitos), sem depender de APIs externas de terceiros.
- **Blindagem Anti-Banimento**:
  - **Cache inteligente de 7 dias**: números já consultados não voltam a gerar requisições repetidas ao WhatsApp quando outro ficheiro é importado.
  - **Pré-validação estrutural por país**: filtra localmente números malformados ou impossíveis antes de consultar o WhatsApp.
  - **Micro-lotes variáveis e Jitter Humano**: consulta em pequenos grupos aleatórios com pausas variáveis e arrefecimento periódico automático.
  - **Divisões seguras de 250 números**: aguarda confirmação manual entre divisões e aplica arrefecimento preventivo quando múltiplos ficheiros são verificados em sequência.