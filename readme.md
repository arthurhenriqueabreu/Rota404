# RotaOk

Assistente de entregas para pequenos mercados descobrirem se uma entrega compensa antes de sair.

## Problema

Pequenos comércios cobram frete sem saber se o valor cobre combustível, tempo do entregador e custo real da rota.

## Solução

Bot no Telegram que calcula frete recebido, custo estimado, saldo e mostra se a entrega compensa.

## Diferencial

"O mapa mostra o caminho. O RotaOk mostra se vale a pena."

## Como rodar

1. Instale dependências:

```bash
npm install
```

2. Crie o `.env`:

```bash
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Preencha as variáveis no `.env`.

4. Rode validações:

```bash
npm run check
```

5. Inicie o bot:

```bash
npm run bot
```

## Variáveis de ambiente

- `BOT_TOKEN` (obrigatória)
- `ORS_API_KEY` (opcional)

## Comandos

- `/start`
- `/demo`
- `/nova_rota`
- `/cancelar`
- `/ajuda`

## Observação

O MVP usa cálculo estimado como fallback e tem integração opcional com OpenRouteService.
