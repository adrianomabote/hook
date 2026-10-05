# Verificador de números WhatsApp

## Executar

- Comando: `npm start`
- O servidor serve a interface e a API na porta 5000.
- O projeto usa Node.js sem dependências adicionais.

## Verificação real

- O servidor usa os endpoints de verificação de existência de números da Z-API.
- Configure os secrets `ZAPI_INSTANCE_ID` e `ZAPI_TOKEN`; adicione também `ZAPI_CLIENT_TOKEN` quando exigido pela conta. Nunca coloque credenciais no frontend nem no código.
- A instância Z-API deve estar ativa antes de consultar.
- O verificador consulta se existe uma conta e não envia mensagens; os estados são `valid`, `invalid` ou não confirmado quando a resposta não é conclusiva.
- A interface aceita até 100.000 números únicos numa lista e envia-os ao servidor numa consulta; o servidor verifica-os em divisões sequenciais de até 1.000 números.
- Nas listas acima de 1.000, os números e resultados do trabalho ficam temporariamente na memória do servidor até a verificação terminar; o estado fica disponível para consulta durante 30 minutos.
- Números sem código de país são normalizados usando o país escolhido na interface.

## Privacidade e limites

- Os números consultados são enviados à Z-API para validação.
- O token é mantido no servidor e nunca devolvido pela API do app.
- A API limita o tamanho de cada lote e o ritmo de requisições. Os limites do plano Whapi.Cloud continuam se aplicando.
- O site e a API exigem autenticação por palavra-passe. Mantenha `SITE_PASSWORD` e `SESSION_SECRET` configurados como Secrets antes de publicar; a sessão expira após 12 horas.