require("dotenv").config();

const { Markup, Telegraf } = require("telegraf");

const botToken = process.env.BOT_TOKEN;
const orsApiKey = process.env.ORS_API_KEY;

const ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

const distanceBySize = {
  pequena: 2.5,
  media: 3.5,
  grande: 5
};

const demoBase = {
  mercado: "Mercadinho Bom Retiro",
  enderecoBase: "Rua Blumenau, 100 - Joinville",
  veiculo: "Moto",
  consumoKmL: 35,
  precoCombustivel: 5.9,
  valorHoraEntregador: 12
};

const demoDeliveries = [
  { nome: "Ana", endereco: "Rua Max Colin, 800", tamanho: "pequena", frete: 8 },
  { nome: "Carlos", endereco: "Rua Otto Boehm, 300", tamanho: "media", frete: 8 },
  { nome: "Julia", endereco: "Rua XV de Novembro, 950", tamanho: "pequena", frete: 8 },
  { nome: "Pedro", endereco: "Rua Blumenau, 1500", tamanho: "media", frete: 8 },
  { nome: "Mercado Norte", endereco: "Rua Dona Francisca, 1200", tamanho: "grande", frete: 10 }
];

const sessions = new Map();

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatKm(value) {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return `${rounded} km`;
  return `${rounded.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function formatMinutes(value) {
  return `${Math.round(value)} min`;
}

function parseMoney(text) {
  const parsed = Number.parseFloat(String(text).replace(/[R$\s]/gi, "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cloneDemoData() {
  return {
    ...demoBase,
    entregas: demoDeliveries.map((delivery) => ({ ...delivery }))
  };
}

function createSession() {
  return {
    mode: "idle",
    step: null,
    mercado: demoBase.mercado,
    enderecoBase: demoBase.enderecoBase,
    veiculo: demoBase.veiculo,
    consumoKmL: demoBase.consumoKmL,
    precoCombustivel: demoBase.precoCombustivel,
    valorHoraEntregador: demoBase.valorHoraEntregador,
    entregas: [],
    entregaAtual: null,
    lastRoute: null
  };
}

function getSession(chatId) {
  if (!sessions.has(chatId)) sessions.set(chatId, createSession());
  return sessions.get(chatId);
}

function resetSession(chatId) {
  const session = createSession();
  sessions.set(chatId, session);
  return session;
}

function normalizeSize(sizeText) {
  const normalized = String(sizeText).trim().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (normalized.startsWith("peq")) return "pequena";
  if (normalized.startsWith("med")) return "media";
  if (normalized.startsWith("gra")) return "grande";
  return null;
}

function sessionToData(session) {
  return {
    mercado: session.mercado,
    enderecoBase: session.enderecoBase,
    veiculo: session.veiculo,
    consumoKmL: session.consumoKmL,
    precoCombustivel: session.precoCombustivel,
    valorHoraEntregador: session.valorHoraEntregador,
    baseLocation: session.baseLocation,
    entregas: session.entregas.map((delivery) => ({ ...delivery }))
  };
}

function hasOpenRouteService() {
  return Boolean(orsApiKey && String(orsApiKey).trim());
}

function hasCoordinates(data) {
  if (!data || !data.baseLocation || typeof data.baseLocation.lat !== "number" || typeof data.baseLocation.lon !== "number") {
    return false;
  }
  if (!Array.isArray(data.entregas) || !data.entregas.length) {
    return false;
  }
  return data.entregas.every((delivery) => (
    delivery.location
    && typeof delivery.location.lat === "number"
    && typeof delivery.location.lon === "number"
  ));
}

function computeCostSummary(data, distanceKm, timeMin, source) {
  const litrosUsados = distanceKm / data.consumoKmL;
  const custoCombustivel = litrosUsados * data.precoCombustivel;
  const custoEntregador = (timeMin / 60) * data.valorHoraEntregador;
  const custoTotal = custoCombustivel + custoEntregador;
  const freteTotal = data.entregas.reduce((acc, delivery) => acc + delivery.frete, 0);
  const saldo = freteTotal - custoTotal;

  return {
    distanciaTotalKm: distanceKm,
    tempoMin: timeMin,
    custoCombustivel,
    custoEntregador,
    custoTotal,
    freteTotal,
    saldo,
    compensa: saldo >= 0,
    source
  };
}

function calculateMockRoute(data) {
  if (!data || !Array.isArray(data.entregas) || !data.entregas.length) return null;

  const distanceKm = data.entregas.reduce((acc, delivery) => {
    return acc + (distanceBySize[delivery.tamanho] || 0);
  }, 0);
  const timeMin = distanceKm * 3;
  return computeCostSummary(data, distanceKm, timeMin, "mock");
}

async function calculateRealRoute(data) {
  if (!hasOpenRouteService()) {
    throw new Error("ORS_API_KEY ausente");
  }
  if (!hasCoordinates(data)) {
    throw new Error("Coordenadas ausentes");
  }

  const coordinates = [
    [data.baseLocation.lon, data.baseLocation.lat],
    ...data.entregas.map((delivery) => [delivery.location.lon, delivery.location.lat])
  ];

  const response = await fetch(ORS_DIRECTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: orsApiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ coordinates })
  });

  if (!response.ok) {
    throw new Error(`OpenRouteService HTTP ${response.status}`);
  }

  const payload = await response.json();
  const summary = payload
    && payload.features
    && payload.features[0]
    && payload.features[0].properties
    && payload.features[0].properties.summary;

  if (!summary || typeof summary.distance !== "number" || typeof summary.duration !== "number") {
    throw new Error("Resumo de rota inválido");
  }

  const distanceKm = summary.distance / 1000;
  const timeMin = summary.duration / 60;
  return computeCostSummary(data, distanceKm, timeMin, "openrouteservice");
}

async function calculateRoute(data, options = {}) {
  const forceMock = Boolean(options.forceMock);
  if (forceMock) {
    return calculateMockRoute(data);
  }

  if (hasOpenRouteService() && hasCoordinates(data)) {
    try {
      return await calculateRealRoute(data);
    } catch (error) {
      return calculateMockRoute(data);
    }
  }

  return calculateMockRoute(data);
}

function buildRouteMessage(data, route) {
  const result = route || calculateMockRoute(data);
  if (!result) return "Ainda não há entregas suficientes para calcular a rota.";

  const order = data.entregas
    .map((delivery, index) => `${index + 1}. ${delivery.nome} - ${delivery.endereco}`)
    .join("\n");

  const sourceMessage = result.source === "openrouteservice"
    ? "Rota calculada com dados reais de mapa via OpenRouteService."
    : "Distâncias estimadas para demonstração.";

  return [
    "✅ RotaOk",
    "",
    `📦 Entregas: ${data.entregas.length}`,
    `🗺️ Distância: ${formatKm(result.distanciaTotalKm)}`,
    `⏱️ Tempo: ${formatMinutes(result.tempoMin)}`,
    "",
    `💰 Frete recebido: ${formatCurrency(result.freteTotal)}`,
    `📉 Custo estimado: ${formatCurrency(result.custoTotal)}`,
    `💵 Saldo: ${formatCurrency(result.saldo)}`,
    "",
    result.compensa ? "✅ Essa entrega compensa." : "⚠️ Essa entrega pode dar prejuízo.",
    "",
    "🧭 Ordem sugerida:",
    `Saída: ${data.mercado}`,
    order,
    "",
    "\"O mapa mostra o caminho. O RotaOk mostra se vale a pena.\"",
    "",
    sourceMessage
  ].join("\n");
}

function parseDeliveryLine(line) {
  const parts = line.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const frete = parseMoney(parts[2]);
  if (!frete) return null;
  return {
    nome: parts[0],
    endereco: parts[1],
    tamanho: "media",
    frete
  };
}

function parseDeliveriesList(text) {
  const lines = String(text).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { error: "Nenhuma linha detectada." };
  const deliveries = [];

  for (const line of lines) {
    const parsed = parseDeliveryLine(line);
    if (!parsed) return { error: `Formato inválido em: "${line}"` };
    deliveries.push(parsed);
  }

  return { entregas: deliveries };
}

function parseCosts(text) {
  const tokens = String(text).trim().split(/\s+/);
  const map = {};
  tokens.forEach((token) => {
    const [key, value] = token.split("=");
    if (key && value) map[key.toLowerCase()] = value;
  });

  const consumo = parseMoney(map.consumo);
  const gasolina = parseMoney(map.gasolina);
  const hora = parseMoney(map.hora);
  const frete = parseMoney(map.frete);

  if (!consumo || !gasolina || !hora || !frete) {
    return { error: "Não entendi esse valor. Tente assim: 8 ou 8.50" };
  }

  return { consumo, gasolina, hora, frete };
}

function buildStartMessage() {
  return [
    "Olá! Eu sou o RotaOk, seu assistente de entregas.",
    "Eu ajudo pequenos mercados a descobrir se uma entrega compensa antes de sair.",
    "Escolha uma opção para começar:"
  ].join("\n\n");
}

function buildClientMessage() {
  return [
    "📲 Visão do cliente",
    "",
    "Mercadinho Bom Retiro:",
    "\"Olá, Ana! Seu pedido foi recebido.",
    "",
    "✅ Seu pedido entrou na rota de entrega.",
    "⏱️ Previsão estimada: 25 minutos.",
    "📍 Você é a parada 1 de 5.",
    "🛵 O entregador saiu para entrega.\""
  ].join("\n");
}

function mainKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🚀 Carregar demo", "load_demo"), Markup.button.callback("🎬 Demo em 1 clique", "demo_one_click")],
    [Markup.button.callback("⚡ Rota rápida", "quick_route"), Markup.button.callback("🧾 Colar entregas", "paste_deliveries")],
    [Markup.button.callback("⚙️ Ajustar custos", "adjust_costs"), Markup.button.callback("ℹ️ Sobre", "about")]
  ]);
}

function quickRouteKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🧾 Colar lista", "paste_deliveries"), Markup.button.callback("➕ Adicionar uma por uma", "add_one_by_one")],
    [Markup.button.callback("📍 Usar localizações", "use_locations"), Markup.button.callback("❌ Cancelar", "cancel_flow")]
  ]);
}

function afterResultKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📲 Ver visão do cliente", "client_view"), Markup.button.callback("⚙️ Ajustar custos", "adjust_costs")],
    [Markup.button.callback("🔄 Nova rota", "new_route")]
  ]);
}

function afterDeliveryKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Adicionar outra", "add_one_by_one"), Markup.button.callback("✅ Calcular rota", "calc_route")],
    [Markup.button.callback("❌ Cancelar", "cancel_flow")]
  ]);
}

function withInlineMode(text) {
  return { parse_mode: "Markdown", ...text };
}

function menuMessage(ctx, text, keyboard) {
  if (ctx.updateType === "callback_query" && ctx.callbackQuery && ctx.callbackQuery.message) {
    return ctx.editMessageText(text, keyboard).catch(() => ctx.reply(text, keyboard));
  }
  return ctx.reply(text, keyboard);
}

async function sendDemoSummary(ctx, chatId) {
  const session = resetSession(chatId);
  const demoData = cloneDemoData();
  session.entregas = demoData.entregas;
  const route = await calculateRoute(demoData, { forceMock: true });
  session.lastRoute = route;
  await ctx.reply("🚀 Demo carregada\nMercadinho Bom Retiro\n5 entregas adicionadas");
  return ctx.reply(buildRouteMessage(demoData, route), afterResultKeyboard());
}

function configureBot(bot) {
  bot.start((ctx) => {
    resetSession(ctx.chat.id);
    return ctx.reply(buildStartMessage(), mainKeyboard());
  });

  bot.command("demo", (ctx) => sendDemoSummary(ctx, ctx.chat.id));

  bot.command("nova_rota", (ctx) => {
    resetSession(ctx.chat.id);
    return ctx.reply("Rota reiniciada.", mainKeyboard());
  });

  bot.command("cancelar", (ctx) => {
    const session = getSession(ctx.chat.id);
    session.mode = "idle";
    session.step = null;
    session.entregaAtual = null;
    return ctx.reply("Fluxo cancelado.", mainKeyboard());
  });

  bot.command("ajuda", (ctx) => {
    return ctx.reply(
      "Use os botões para navegar. Comandos: /start, /demo, /nova_rota, /cancelar, /ajuda.",
      mainKeyboard()
    );
  });

  bot.action("about", async (ctx) => {
    await ctx.answerCbQuery();
    return menuMessage(
      ctx,
      "RotaOk calcula se a entrega compensa com custo e saldo. Fluxo rápido, botões inline e fallback estável.",
      mainKeyboard()
    );
  });

  bot.action("load_demo", async (ctx) => {
    await ctx.answerCbQuery();
    return sendDemoSummary(ctx, ctx.chat.id);
  });

  bot.action("demo_one_click", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("🎬 Rodando demo em 1 clique...");
    await sendDemoSummary(ctx, ctx.chat.id);
    return ctx.reply(buildClientMessage(), Markup.inlineKeyboard([
      [Markup.button.callback("🧭 Voltar para rota", "back_to_route"), Markup.button.callback("🔄 Nova rota", "new_route")]
    ]));
  });

  bot.action("quick_route", async (ctx) => {
    await ctx.answerCbQuery();
    const session = getSession(ctx.chat.id);
    session.mode = "quick";
    session.step = "choose_input";
    return menuMessage(
      ctx,
      [
        "Vamos fazer do jeito rápido.",
        "",
        "Vou usar valores padrão:",
        "🛵 Moto",
        "⛽ 35 km/L",
        "💰 Gasolina R$ 5,90",
        "👤 Entregador R$ 12/h",
        "",
        "Como você quer adicionar as entregas?"
      ].join("\n"),
      quickRouteKeyboard()
    );
  });

  bot.action("use_locations", async (ctx) => {
    await ctx.answerCbQuery();
    return menuMessage(
      ctx,
      "Uso de localização real preparado para integração com mapa.",
      quickRouteKeyboard()
    );
  });

  bot.action("paste_deliveries", async (ctx) => {
    await ctx.answerCbQuery();
    const session = getSession(ctx.chat.id);
    session.mode = "quick";
    session.step = "await_paste";
    return menuMessage(
      ctx,
      [
        "Cole suas entregas neste formato:",
        "",
        "Ana, Rua Max Colin 800, 8",
        "Carlos, Rua Otto Boehm 300, 8",
        "Julia, Rua XV de Novembro 950, 8"
      ].join("\n"),
      Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "cancel_flow")]])
    );
  });

  bot.action("add_one_by_one", async (ctx) => {
    await ctx.answerCbQuery();
    const session = getSession(ctx.chat.id);
    session.mode = "quick";
    session.step = "await_single";
    return menuMessage(
      ctx,
      "Envie uma entrega por vez no formato: Nome, Endereço, Frete.\nEx: Ana, Rua Max Colin 800, 8",
      afterDeliveryKeyboard()
    );
  });

  bot.action("adjust_costs", async (ctx) => {
    await ctx.answerCbQuery();
    const session = getSession(ctx.chat.id);
    session.mode = "adjust";
    session.step = "await_costs";
    return menuMessage(
      ctx,
      "Envie os custos em uma linha:\nconsumo=35 gasolina=5.90 hora=12 frete=8",
      Markup.inlineKeyboard([[Markup.button.callback("❌ Cancelar", "cancel_flow")]])
    );
  });

  bot.action("calc_route", async (ctx) => {
    await ctx.answerCbQuery();
    const session = getSession(ctx.chat.id);
    if (!session.entregas.length) {
      return ctx.reply("Não há entregas para calcular.", quickRouteKeyboard());
    }

    const data = sessionToData(session);
    const route = await calculateRoute(data);
    session.lastRoute = route;
    session.mode = "idle";
    session.step = null;
    return ctx.reply(buildRouteMessage(data, route), afterResultKeyboard());
  });

  bot.action("client_view", async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply(buildClientMessage(), Markup.inlineKeyboard([
      [Markup.button.callback("🧭 Voltar para rota", "back_to_route"), Markup.button.callback("🔄 Nova rota", "new_route")]
    ]));
  });

  bot.action("back_to_route", async (ctx) => {
    await ctx.answerCbQuery();
    const session = getSession(ctx.chat.id);
    const data = session.entregas.length ? sessionToData(session) : cloneDemoData();
    const route = session.lastRoute || await calculateRoute(data, { forceMock: true });
    return ctx.reply(buildRouteMessage(data, route), afterResultKeyboard());
  });

  bot.action("new_route", async (ctx) => {
    await ctx.answerCbQuery();
    resetSession(ctx.chat.id);
    return menuMessage(ctx, buildStartMessage(), mainKeyboard());
  });

  bot.action("cancel_flow", async (ctx) => {
    await ctx.answerCbQuery();
    const session = getSession(ctx.chat.id);
    session.mode = "idle";
    session.step = null;
    session.entregaAtual = null;
    return menuMessage(ctx, "Fluxo cancelado. Escolha uma opção:", mainKeyboard());
  });

  bot.on("text", async (ctx) => {
    const session = getSession(ctx.chat.id);
    if (!session.step) return;

    const text = ctx.message.text.trim();

    if (session.step === "await_paste") {
      const parsed = parseDeliveriesList(text);
      if (parsed.error) {
        return ctx.reply(`Não entendi essa lista. ${parsed.error}`);
      }

      session.entregas = parsed.entregas;
      session.step = "confirm_paste";
      const freteTotal = parsed.entregas.reduce((acc, delivery) => acc + delivery.frete, 0);

      return ctx.reply(
        [
          `Detectei ${parsed.entregas.length} entregas.`,
          "",
          `💰 Frete total: ${formatCurrency(freteTotal)}`,
          "📦 Tamanho padrão: médio"
        ].join("\n"),
        Markup.inlineKeyboard([
          [Markup.button.callback("✅ Calcular rota", "calc_route"), Markup.button.callback("✏️ Corrigir lista", "paste_deliveries")],
          [Markup.button.callback("❌ Cancelar", "cancel_flow")]
        ])
      );
    }

    if (session.step === "await_single") {
      const parsed = parseDeliveryLine(text);
      if (!parsed) {
        return ctx.reply("Não entendi esse valor. Tente assim: 8 ou 8.50");
      }

      session.entregas.push(parsed);
      const partialFee = session.entregas.reduce((acc, delivery) => acc + delivery.frete, 0);

      return ctx.reply(
        [
          "Entrega adicionada:",
          "",
          parsed.nome,
          parsed.endereco,
          `Frete: ${formatCurrency(parsed.frete)}`,
          "",
          `Paradas adicionadas: ${session.entregas.length}`,
          `Frete parcial: ${formatCurrency(partialFee)}`
        ].join("\n"),
        afterDeliveryKeyboard()
      );
    }

    if (session.step === "await_costs") {
      const parsed = parseCosts(text);
      if (parsed.error) {
        return ctx.reply(parsed.error);
      }

      session.consumoKmL = parsed.consumo;
      session.precoCombustivel = parsed.gasolina;
      session.valorHoraEntregador = parsed.hora;
      if (session.entregas.length) {
        session.entregas = session.entregas.map((delivery) => ({ ...delivery, frete: parsed.frete }));
      }
      session.mode = "idle";
      session.step = null;

      return ctx.reply(
        [
          "Custos ajustados:",
          `⛽ Consumo: ${session.consumoKmL} km/L`,
          `💰 Gasolina: ${formatCurrency(session.precoCombustivel)}`,
          `👤 Entregador: ${formatCurrency(session.valorHoraEntregador)}/h`,
          `📦 Frete padrão: ${formatCurrency(parsed.frete)}`
        ].join("\n"),
        mainKeyboard()
      );
    }
  });

  bot.catch((error, ctx) => {
    console.error(`Erro no update ${ctx.update.update_id}:`, error);
  });

  return bot;
}

function createBot(token) {
  return configureBot(new Telegraf(token));
}

if (require.main === module) {
  if (!botToken) {
    console.error("BOT_TOKEN nao encontrado. Crie um arquivo .env com BOT_TOKEN=seu_token.");
    process.exit(1);
  }

  const bot = createBot(botToken);
  bot.launch()
    .then(() => {
      console.log("RotaOk Telegram bot iniciado.");
    })
    .catch((error) => {
      console.error("Falha ao iniciar o bot:", error.message);
      process.exit(1);
    });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

module.exports = {
  buildClientMessage,
  buildRouteMessage,
  calculateMockRoute,
  calculateRealRoute,
  calculateRoute,
  configureBot,
  createBot,
  createSession,
  hasOpenRouteService,
  mensagemCliente: buildClientMessage,
  mensagemInicial: buildStartMessage,
  normalizeSize,
  parseCosts,
  parseDeliveriesList
};
