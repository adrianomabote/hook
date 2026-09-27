# Verificador de números WhatsApp

## Executar

- Comando: `npm start`
- O servidor serve a interface e a API na porta 5000.
- O projeto usa Node.js sem dependências adicionais.

## Verificação real

- O servidor chama `POST https://gate.whapi.cloud/contacts` no Whapi.Cloud.
- Configure o token do canal Whapi.Cloud como Secret `WHAPI_TOKEN`; nunca coloque o token no frontend nem no código.
- No Whapi.Cloud, conecte o número pelo QR Code antes de consultar.
- O verificador não envia mensagens. A consulta é enviada ao Whapi.Cloud e retorna os estados `valid` ou `invalid`; resultados sem resposta são mostrados como não confirmados.
- O frontend envia até 50 números por chamada e não armazena arquivos ou resultados no servidor.
- Cada consulta aceita até 1.500 números únicos; divida ficheiros maiores em várias consultas.
- Números sem código de país são normalizados usando o país escolhido na interface.

## Privacidade e limites

- Os números consultados são enviados ao Whapi.Cloud para validação.
- O token é mantido no servidor e nunca devolvido pela API do app.
- A API limita o tamanho de cada lote e o ritmo de requisições. Os limites do plano Whapi.Cloud continuam se aplicando.
- Antes de publicar para outras pessoas, configure autenticação de acesso para proteger o uso do seu canal e do saldo do provedor.