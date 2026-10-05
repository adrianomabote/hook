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
- A interface aceita até 100.000 números únicos numa lista e envia-os ao servidor numa consulta; o servidor verifica até 1.000 por divisão e aguarda um clique antes de cada divisão seguinte.
- Nas listas acima de 1.000, o trabalho fica temporariamente na memória do servidor; se ficar pausado sem clique por 30 minutos, expira. Os resultados concluídos ficam disponíveis durante 30 minutos.
- Números sem código de país são normalizados usando o país escolhido na interface.

## Privacidade e limites

- Os números consultados são enviados à Z-API para validação.
- O token é mantido no servidor e nunca devolvido pela API do app.
- A API limita o tamanho de cada lista e o ritmo das consultas; os limites do plano Z-API continuam se aplicando.
- O site e a API exigem autenticação por palavra-passe. Mantenha `SITE_PASSWORD` e `SESSION_SECRET` configurados como Secrets antes de publicar; a sessão expira após 12 horas.