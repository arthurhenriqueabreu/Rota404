const assert = require("assert");

const {
  buildRouteMessage,
  buildClientMessage,
  calculateMockRoute,
  calculateRoute,
  createSession,
  mensagemInicial,
  hasOpenRouteService,
  parseDeliveriesList
} = require("./bot");

const baseData = {
  mercado: "Mercadinho Bom Retiro",
  enderecoBase: "Rua Blumenau, 100 - Joinville",
  veiculo: "Moto",
  consumoKmL: 35,
  precoCombustivel: 5.9,
  valorHoraEntregador: 12,
  entregas: [
    { nome: "Ana", endereco: "Rua Max Colin, 800", tamanho: "pequena", frete: 8 },
    { nome: "Carlos", endereco: "Rua Otto Boehm, 300", tamanho: "media", frete: 8 },
    { nome: "Julia", endereco: "Rua XV de Novembro, 950", tamanho: "pequena", frete: 8 },
    { nome: "Pedro", endereco: "Rua Blumenau, 1500", tamanho: "media", frete: 8 },
    { nome: "Mercado Norte", endereco: "Rua Dona Francisca, 1200", tamanho: "grande", frete: 10 }
  ]
};

async function main() {
  const rota = calculateMockRoute(baseData);

  assert.strictEqual(rota.distanciaTotalKm, 17);
  assert.strictEqual(Math.round(rota.tempoMin), 51);
  assert.strictEqual(Math.round(rota.freteTotal * 100), 4200);
  assert.strictEqual(Math.round(rota.custoCombustivel * 100), 287);
  assert.strictEqual(Math.round(rota.custoEntregador * 100), 1020);
  assert.strictEqual(Math.round(rota.custoTotal * 100), 1307);
  assert.strictEqual(Math.round(rota.saldo * 100), 2893);
  assert.strictEqual(rota.compensa, true);
  assert.strictEqual(rota.source, "mock");

  const resumo = buildRouteMessage(baseData, rota);

  assert.ok(resumo.includes("Mercadinho Bom Retiro"));
  assert.ok(resumo.includes("17 km"));
  assert.ok(resumo.includes("51 min"));
  assert.ok(resumo.includes("42,00"));
  assert.ok(resumo.includes("28,93"));
  assert.ok(resumo.includes("Essa entrega compensa"));
  assert.ok(resumo.includes("O mapa mostra o caminho"));

  assert.ok(mensagemInicial().includes("RotaOk"));
  assert.ok(buildClientMessage().includes("Olá, Ana!"));
  assert.ok(buildClientMessage().includes("parada 1 de 5"));

  const parsedDeliveries = parseDeliveriesList(
    "Ana, Rua Max Colin 800, 8\nCarlos, Rua Otto Boehm 300, 8"
  );
  assert.ok(!parsedDeliveries.error);
  assert.strictEqual(parsedDeliveries.entregas.length, 2);
  assert.strictEqual(parsedDeliveries.entregas[1].tamanho, "media");

  const session = createSession();
  assert.strictEqual(session.mode, "idle");
  assert.ok(Array.isArray(session.entregas));

  assert.ok(typeof hasOpenRouteService() === "boolean");

  const fallbackRoute = await calculateRoute(baseData);
  assert.strictEqual(fallbackRoute.source, "mock");
  assert.strictEqual(Math.round(fallbackRoute.distanciaTotalKm), 17);

  console.log("Validação local OK: cálculo e mensagens do bot conferidos.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
