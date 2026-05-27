const appState = {
  marketName: "",
  baseAddress: "",
  vehicleType: "",
  fuelEfficiencyKmL: 0,
  fuelPrice: 0,
  driverHourlyCost: 0,
  defaultDeliveryFee: 0,
  deliveries: [],
  currentStep: "marketName"
};

const conversation = {
  id: "rotalucro",
  name: "RotaLucro Assistente",
  initials: "RL",
  status: "Assistente de entregas online",
  color: "#d9fdd3",
  ink: "#008069",
  time: "Agora",
  unread: 0,
  messages: []
};

const app = document.querySelector(".app");
const list = document.querySelector("#conversation-list");
const messages = document.querySelector("#messages");
const contactAvatar = document.querySelector("#contact-avatar");
const contactName = document.querySelector("#contact-name");
const contactStatus = document.querySelector("#contact-status");
const composer = document.querySelector("#composer");
const messageInput = document.querySelector("#new-message");
const search = document.querySelector("#search");
const back = document.querySelector("#back");
const quickActions = document.querySelector("#quick-actions");
const loadDemoButton = document.querySelector("#load-demo");
let deliveryDraft = {};
let routeSummary = null;

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function timeNow() {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalizeText(text) {
  return text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseNumber(text) {
  const value = Number.parseFloat(text.trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatCurrency(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatKm(value) {
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function formatMinutes(value) {
  if (value < 60) {
    return `${Math.round(value)} min`;
  }

  const hours = Math.floor(value / 60);
  const minutes = Math.round(value % 60);
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function previewText() {
  const lastMessage = conversation.messages.at(-1);
  if (!lastMessage) {
    return "Comece seu planejamento de entregas";
  }

  return `${lastMessage.sent ? "Você: " : ""}${lastMessage.text}`;
}

function renderList(query = "") {
  const visible = conversation.name.toLowerCase().includes(query.trim().toLowerCase());
  list.innerHTML = visible ? `
    <article class="conversation selected" data-id="${conversation.id}" tabindex="0">
      <div class="avatar" style="background:${conversation.color}; color:${conversation.ink}">${conversation.initials}</div>
      <div class="conversation-content">
        <h3>${escapeHtml(conversation.name)}</h3>
        <time>${escapeHtml(conversation.time)}</time>
        <p class="preview">${escapeHtml(previewText())}</p>
      </div>
    </article>
  ` : "";
}

function renderMessages() {
  contactAvatar.textContent = conversation.initials;
  contactAvatar.style.background = conversation.color;
  contactAvatar.style.color = conversation.ink;
  contactName.textContent = conversation.name;
  contactStatus.textContent = conversation.status;

  messages.innerHTML = `
    <div class="date-pill">Hoje</div>
    ${conversation.messages.map((message) => `
      <div class="message ${message.sent ? "sent" : ""}">
        <p>${escapeHtml(message.text)}</p>
        <time>${escapeHtml(message.time)}${message.sent ? '<span class="checks">&#10003;&#10003;</span>' : ""}</time>
      </div>
    `).join("")}
    ${routeSummary ? renderSummary() : ""}
  `;
  quickActions.hidden = appState.currentStep !== "deliveryDecision";
  messages.scrollTop = messages.scrollHeight;
}

function addBotMessage(text) {
  conversation.messages.push({ text, time: timeNow(), sent: false });
  conversation.time = timeNow();
}

function addUserMessage(text) {
  conversation.messages.push({ text, time: timeNow(), sent: true });
  conversation.time = timeNow();
}

function refreshConversation() {
  renderList(search.value);
  renderMessages();
}

function askNextStep(step, question) {
  appState.currentStep = step;
  addBotMessage(question);
}

function handleUserInput(text) {
  const value = text.trim();
  if (!value) {
    return;
  }

  addUserMessage(value);
  if (appState.currentStep.startsWith("delivery") || appState.currentStep === "deliveryDecision") {
    addDeliveryFlow(value);
  } else if (appState.currentStep === "complete") {
    addBotMessage("A rota já está calculada. Use Carregar demo para visualizar outro exemplo.");
  } else {
    advanceFlow(value);
  }
  refreshConversation();
}

function advanceFlow(text) {
  if (appState.currentStep === "marketName") {
    appState.marketName = text;
    askNextStep("baseAddress", "Qual o endereço de saída do entregador?");
    return;
  }

  if (appState.currentStep === "baseAddress") {
    appState.baseAddress = text;
    askNextStep("vehicleType", "Qual veículo será usado? Ex: moto, carro ou bicicleta.");
    return;
  }

  if (appState.currentStep === "vehicleType") {
    appState.vehicleType = text;
    askNextStep("fuelEfficiencyKmL", "Quantos km por litro esse veículo faz? Ex: 35");
    return;
  }

  const number = parseNumber(text);
  if (!number) {
    addBotMessage("Informe um número maior que zero, por favor.");
    return;
  }

  if (appState.currentStep === "fuelEfficiencyKmL") {
    appState.fuelEfficiencyKmL = number;
    askNextStep("fuelPrice", "Qual o preço atual do combustível? Ex: 5.90");
  } else if (appState.currentStep === "fuelPrice") {
    appState.fuelPrice = number;
    askNextStep("driverHourlyCost", "Quanto custa a hora do entregador? Ex: 12");
  } else if (appState.currentStep === "driverHourlyCost") {
    appState.driverHourlyCost = number;
    askNextStep("defaultDeliveryFee", "Qual o frete padrão cobrado por entrega? Ex: 8");
  } else if (appState.currentStep === "defaultDeliveryFee") {
    appState.defaultDeliveryFee = number;
    addBotMessage("Dados do mercado cadastrados. Agora vamos incluir as entregas.");
    askNextStep("deliveryCustomerName", "Qual o nome do cliente da primeira entrega?");
  }
}

function addDeliveryFlow(text) {
  if (appState.currentStep === "deliveryCustomerName") {
    deliveryDraft.customerName = text;
    askNextStep("deliveryAddress", "Qual o endereço da entrega?");
    return;
  }

  if (appState.currentStep === "deliveryAddress") {
    deliveryDraft.address = text;
    askNextStep("deliverySize", "Qual o tamanho da entrega? Pequena, média ou grande.");
    return;
  }

  if (appState.currentStep === "deliverySize") {
    const size = normalizeText(text);
    if (!["pequena", "media", "grande"].includes(size)) {
      addBotMessage("Escolha um tamanho: pequena, média ou grande.");
      return;
    }
    deliveryDraft.size = size;
    askNextStep(
      "deliveryFee",
      `Qual o frete cobrado para esta entrega? Ex: ${formatCurrency(appState.defaultDeliveryFee)}`
    );
    return;
  }

  if (appState.currentStep === "deliveryFee") {
    const deliveryFee = parseNumber(text);
    if (!deliveryFee) {
      addBotMessage("Informe o valor do frete em número. Ex: 8");
      return;
    }
    deliveryDraft.deliveryFee = deliveryFee;
    appState.deliveries.push({ ...deliveryDraft });
    deliveryDraft = {};
    addBotMessage(`Entrega cadastrada! Você tem ${appState.deliveries.length} entrega(s) na rota.`);
    askNextStep("deliveryDecision", "Deseja adicionar outra entrega ou calcular rota?");
    return;
  }

  const action = normalizeText(text);
  if (action.includes("adicionar")) {
    askNextStep("deliveryCustomerName", "Qual o nome do cliente da próxima entrega?");
  } else if (action.includes("calcular")) {
    calculateRoute();
  } else {
    addBotMessage("Use uma das opções: Adicionar entrega ou Calcular rota.");
  }
}

function calculateRoute() {
  if (!appState.deliveries.length) {
    addBotMessage("Cadastre ao menos uma entrega antes de calcular a rota.");
    return null;
  }

  const distancePerSize = { pequena: 2.5, media: 3.5, grande: 5 };
  const distanceKm = appState.deliveries.reduce(
    (total, delivery) => total + distancePerSize[delivery.size],
    0
  );
  const timeMin = distanceKm * 3;
  const litersUsed = distanceKm / appState.fuelEfficiencyKmL;
  const fuelCost = litersUsed * appState.fuelPrice;
  const driverCost = (timeMin / 60) * appState.driverHourlyCost;
  const totalCost = fuelCost + driverCost;
  const totalFees = appState.deliveries.reduce((total, delivery) => total + delivery.deliveryFee, 0);
  const balance = totalFees - totalCost;

  routeSummary = {
    distanceKm,
    timeMin,
    fuelCost,
    driverCost,
    totalCost,
    totalFees,
    balance,
    profitable: balance >= 0
  };
  appState.currentStep = "complete";
  addBotMessage("Rota calculada! Confira abaixo a estimativa de resultado.");
  return routeSummary;
}

function renderSummary() {
  const status = routeSummary.profitable ? "Lucro" : "Prejuízo";
  return `
    <section class="summary-card" aria-label="Resumo da rota calculada">
      <h3>Resumo da rota</h3>
      <p class="route-note">Estimativa mockada, sem mapa ou trânsito real.</p>
      <dl class="summary-grid">
        <dt>Mercado</dt><dd>${escapeHtml(appState.marketName)}</dd>
        <dt>Endereço base</dt><dd>${escapeHtml(appState.baseAddress)}</dd>
        <dt>Veículo</dt><dd>${escapeHtml(appState.vehicleType)}</dd>
        <dt>Consumo</dt><dd>${formatKm(appState.fuelEfficiencyKmL)}/L</dd>
        <dt>Gasolina</dt><dd>${formatCurrency(appState.fuelPrice)}/L</dd>
        <dt>Hora do entregador</dt><dd>${formatCurrency(appState.driverHourlyCost)}</dd>
        <dt>Quantidade de entregas</dt><dd>${appState.deliveries.length}</dd>
        <dt>Frete por entrega</dt><dd>${formatCurrency(appState.defaultDeliveryFee)}</dd>
        <dt>Distância total</dt><dd>${formatKm(routeSummary.distanceKm)}</dd>
        <dt>Tempo estimado</dt><dd>${formatMinutes(routeSummary.timeMin)}</dd>
        <dt>Custo de combustível</dt><dd>${formatCurrency(routeSummary.fuelCost)}</dd>
        <dt>Custo do entregador</dt><dd>${formatCurrency(routeSummary.driverCost)}</dd>
        <dt class="summary-total">Custo total</dt><dd class="summary-total">${formatCurrency(routeSummary.totalCost)}</dd>
        <dt>Frete recebido</dt><dd>${formatCurrency(routeSummary.totalFees)}</dd>
        <dt class="summary-total">Saldo estimado</dt><dd class="summary-total">${formatCurrency(routeSummary.balance)}</dd>
      </dl>
      <span class="summary-status ${routeSummary.profitable ? "" : "loss"}">Status: ${status}</span>
      <p class="summary-message">O Google Maps mostra o caminho. O RotaLucro mostra se a entrega compensa.</p>
    </section>
  `;
}

function loadDemo() {
  Object.assign(appState, {
    marketName: "Mercadinho Bom Retiro",
    baseAddress: "Rua Blumenau, 100 - Joinville",
    vehicleType: "Moto",
    fuelEfficiencyKmL: 35,
    fuelPrice: 5.90,
    driverHourlyCost: 12,
    defaultDeliveryFee: 8,
    deliveries: [
      { customerName: "Ana Souza", address: "Rua Max Colin, 420 - Joinville", size: "pequena", deliveryFee: 8 },
      { customerName: "Padaria Central", address: "Rua Dona Francisca, 250 - Joinville", size: "media", deliveryFee: 8 },
      { customerName: "João Lima", address: "Rua XV de Novembro, 880 - Joinville", size: "pequena", deliveryFee: 8 },
      { customerName: "Restaurante Sabor", address: "Rua Otto Boehm, 95 - Joinville", size: "grande", deliveryFee: 8 },
      { customerName: "Marina Costa", address: "Rua Blumenau, 920 - Joinville", size: "media", deliveryFee: 8 }
    ],
    currentStep: "deliveryDecision"
  });
  deliveryDraft = {};
  routeSummary = null;
  conversation.messages = [
    { text: "Olá! Eu sou o RotaLucro. Vamos montar sua rota de entregas?", time: timeNow(), sent: false },
    { text: "Demo carregada com 5 entregas do Mercadinho Bom Retiro.", time: timeNow(), sent: false }
  ];
  calculateRoute();
  app.classList.add("open-chat");
  refreshConversation();
}

function startConversation() {
  conversation.messages = [
    { text: "Olá! Eu sou o RotaLucro. Vamos montar sua rota de entregas?", time: timeNow(), sent: false },
    { text: "Vou te ajudar a calcular custo, frete e lucro da sua rota.", time: timeNow(), sent: false },
    { text: "Qual o nome do mercado?", time: timeNow(), sent: false }
  ];
}

list.addEventListener("click", (event) => {
  if (event.target.closest(".conversation")) {
    app.classList.add("open-chat");
  }
});

list.addEventListener("keydown", (event) => {
  if (event.target.closest(".conversation") && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    app.classList.add("open-chat");
  }
});

search.addEventListener("input", () => renderList(search.value));

composer.addEventListener("submit", (event) => {
  event.preventDefault();
  handleUserInput(messageInput.value);
  messageInput.value = "";
});

quickActions.addEventListener("click", (event) => {
  const action = event.target.dataset.action;
  if (action) {
    handleUserInput(action);
  }
});

loadDemoButton.addEventListener("click", loadDemo);
back.addEventListener("click", () => app.classList.remove("open-chat"));

startConversation();
renderList();
renderMessages();
