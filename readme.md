# 🚚 BotRotaOK — Assistente de Logística para Pequenos Mercados

> Projeto desenvolvido para o **Hackathon — Tema: Logística no Comércio**

---

## 📋 Sobre o Projeto

Pequenos comerciantes frequentemente enfrentam **prejuízos no transporte de encomendas** por falta de planejamento. Rotas mal otimizadas, custos subestimados e falta de controle sobre as entregas são problemas reais do dia a dia.

O **EntregaBot** é uma solução pensada para ser acessada diretamente pelo **Telegram**, facilitando o uso por qualquer funcionário, sem necessidade de instalar aplicativos ou ter conhecimento técnico.

---

## 💡 Solução

Um bot de Telegram que auxilia o funcionário do mercado a:

- Calcular o **custo estimado** de um trajeto de entregas
- Considerar variáveis reais como **preço do combustível**, **tipo de veículo** e **tamanho das mercadorias**
- Registrar o **endereço da loja** como ponto de partida
- Mapear todos os **pontos de entrega** da rota
- Receber um **relatório completo** com custo, distância estimada e tempo

---

## 🖥️ MVP — Simulação

Como MVP, desenvolvemos uma **simulação visual do bot no Telegram**, rodando no navegador em HTML, CSS e JavaScript puro. O objetivo é demonstrar o fluxo completo de interação com o bot, sem necessidade de infraestrutura de backend.

### Fluxo da Simulação

```
/novaentrega
    ↓
💰 Preço do combustível (R$/litro)
    ↓
🚗 Tipo de veículo (Moto ou Carro)
    ↓
📦 Tamanho das mercadorias (Pequeno / Médio / Grande)
    ↓
🏪 Endereço da loja (ponto de partida)
    ↓
📍 Quantidade de paradas
    ↓
📬 Endereço de cada cliente
    ↓
📊 Relatório com custo estimado da rota
```

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Uso |
|---|---|
| HTML5 | Estrutura da interface |
| CSS3 | Estilização inspirada no Telegram |
| JavaScript (Vanilla) | Lógica do fluxo do bot |
| Google Fonts (Inter) | Tipografia |

> **Próximos passos:** integração com a API real do Telegram e Google Maps Distance Matrix API para cálculo real de rotas e distâncias.

---

## 🚀 Como Rodar

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/entrega-bot.git
```

2. Abra o arquivo `entrega-bot.html` diretamente no navegador — não precisa de servidor ou instalação.

---

## 📌 Roadmap Futuro

- [ ] Integração real com a API do Telegram
- [ ] Cálculo de rotas via Google Maps / OSRM
- [ ] Sugestão de ordem otimizada de entregas
- [ ] Histórico de rotas por usuário
- [ ] Relatório exportável em PDF

---

## 👥 Equipe

Miguel Antônio Mota Gonçalves
Arthur Henrique Abreu
Ayron Lucas da Rocha
Felipe Gabriel
Jonathan
Desenvolvido com 💙 durante o Hackathon do Senac— Logística no Comércio.

---

## 📄 Licença

Este projeto está sob a licença MIT.
