require("dotenv").config();

const { Markup, Telegraf } = require("telegraf");

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  console.error("BOT_TOKEN nao encontrado. Crie um arquivo .env com BOT_TOKEN=seu_token.");
  process.exit(1);
}

const bot = new Telegraf(botToken);

const demo = {
  mercado: "Mercadinho Bom Retiro",
  enderecoBase: "Rua Blumenau, 100 - Joinville",
  veiculo: "Moto",
  consumoKmL: 35,
  precoCombustivel: 5.90,
  valorHoraEntregador: 12,
  entregas: [
    { nome: "Ana", endereco: "Rua Max Colin, 800", tamanho: "pequena", frete: 8 },
    { nome: "Carlos", endereco: "Rua Otto Boehm, 300", tamanho: "media", frete: 8 },
    { nome: "Julia", endereco: "Rua XV de Novembro, 950", tamanho: "pequena", frete: 8 },
    { nome: "Pedro", endereco: "Rua Blumenau, 1500", tamanho: "media", frete: 8 },
    { nome: "Mercado Norte", endereco: "Rua Dona Francisca, 1200", tamanho: "grande", frete: 10 }
  ]
};

const distanciaPorTamanho = {
  pequena: 2.5,
  media: 3.5,
  grande: 5
};

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatKm(value) {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })} km`;
}

function formatMinutes(value) {
  return `${Math.round(value)} min`;
}

function calcularRotaMockada() {
  const distanciaTotalKm = demo.entregas.reduce((total, entrega) => {
    return total + distanciaPorTamanho[entrega.tamanho];
  }, 0);

  const tempoMin = distanciaTotalKm * 3;
  const litrosUsados = distanciaTotalKm / demo.consumoKmL;
  const custoCombustivel = litrosUsados * demo.precoCombustivel;
  const custoEntregador = (tempoMin / 60) * demo.valorHoraEntregador;
  const custoTotal = custoCombustivel + custoEntregador;
  const freteTotal = demo.entregas.reduce((total, entrega) => total + entrega.frete, 0);
  const saldo = freteTotal - custoTotal;

  return {
    distanciaTotalKm,
    tempoMin,
    custoCombustivel,
    custoEntregador,
    custoTotal,
    freteTotal,
    saldo,
    status: saldo >= 0 ? "✅ Rota lucrativa" : "⚠️ Rota com prejuízo"
  };
}

function keyboardInicial() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🚀 Carregar demo", "load_demo")],
    [Markup.button.callback("📲 Ver visão do cliente", "client_view")]
  ]);
}

function mensagemInicial() {
  return [
    "Olá! Eu sou o RotaLucro, seu assistente de entregas.",
    "Eu ajudo pequenos mercados a descobrir se uma rota dá lucro ou prejuízo."
  ].join("\n\n");
}

function mensagemResumo() {
  const rota = calcularRotaMockada();
  const ordem = demo.entregas
    .map((entrega, index) => `${index + 1}. ${entrega.nome} - ${entrega.endereco}`)
    .join("\n");

  return [
    "*📍 Resumo da rota*",
    "",
    `🏪 *Mercado:* ${demo.mercado}`,
    `🛵 *Veículo:* ${demo.veiculo}`,
    `📦 *Quantidade de entregas:* ${demo.entregas.length}`,
    `🗺️ *Distância estimada:* ${formatKm(rota.distanciaTotalKm)}`,
    `⏱️ *Tempo estimado:* ${formatMinutes(rota.tempoMin)}`,
    `💰 *Frete recebido:* ${formatCurrency(rota.freteTotal)}`,
    `⛽ *Custo combustível:* ${formatCurrency(rota.custoCombustivel)}`,
    `👤 *Custo entregador:* ${formatCurrency(rota.custoEntregador)}`,
    `📉 *Custo real da rota:* ${formatCurrency(rota.custoTotal)}`,
    `💵 *Saldo estimado:* ${formatCurrency(rota.saldo)}`,
    `*Status:* ${rota.status}`,
    "",
    "*Ordem sugerida:*",
    `Saída: ${demo.mercado}`,
    ordem,
    "",
    "_O Google Maps mostra o caminho. O RotaLucro mostra se a entrega compensa._",
    "",
    "Distâncias estimadas para demonstração. Integração com API de mapas prevista para rota real."
  ].join("\n");
}

function mensagemCliente() {
  return [
    "Olá, Ana! Seu pedido foi recebido pelo Mercadinho Bom Retiro.",
    "Seu pedido entrou na rota de entrega.",
    "Previsão estimada: 25 minutos.",
    "Você é a parada 1 de 5.",
    "O entregador saiu para entrega."
  ].join("\n\n");
}

bot.start((ctx) => {
  return ctx.reply(mensagemInicial(), keyboardInicial());
});

bot.action("load_demo", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply(mensagemResumo(), {
    parse_mode: "Markdown",
    ...keyboardInicial()
  });
});

bot.action("client_view", async (ctx) => {
  await ctx.answerCbQuery();
  return ctx.reply(mensagemCliente(), keyboardInicial());
});

bot.catch((error, ctx) => {
  console.error(`Erro no update ${ctx.update.update_id}:`, error);
});

bot.launch();

console.log("RotaLucro Telegram bot iniciado.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
