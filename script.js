const state = {
  step: "idle",
  combustivel: null,
  veiculo: null,
  tamanho: null,
  enderecoLoja: null,
  qtdParadas: null,
  enderecos: [],
  enderecoAtual: 0
};

const msgs = document.getElementById("messages");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

function scrollDown() {
  msgs.scrollTop = msgs.scrollHeight;
}

function getTime() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function addMessage(who, content, isHTML = false) {
  const row = document.createElement("div");
  row.className = `bubble-row ${who}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (isHTML) {
    bubble.innerHTML = content;
  } else {
    bubble.textContent = content;
  }

  const time = document.createElement("div");
  time.className = "bubble-time";
  time.textContent = getTime();

  const wrap = document.createElement("div");
  wrap.appendChild(bubble);
  wrap.appendChild(time);

  if (who === "bot") {
    const avatar = document.createElement("div");
    avatar.className = "bubble-avatar";
    avatar.textContent = "\u{1F69A}";
    row.appendChild(avatar);
  }

  row.appendChild(wrap);
  msgs.appendChild(row);
  scrollDown();
  return bubble;
}

function addUserMessage(text) {
  const row = document.createElement("div");
  row.className = "bubble-row user";
  const wrap = document.createElement("div");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  const time = document.createElement("div");
  time.className = "bubble-time";
  time.textContent = getTime();
  wrap.appendChild(bubble);
  wrap.appendChild(time);
  row.appendChild(wrap);
  msgs.appendChild(row);
  scrollDown();
}

function showTyping(ms = 1200) {
  return new Promise((resolve) => {
    const row = document.createElement("div");
    row.className = "bubble-row bot";
    const avatar = document.createElement("div");
    avatar.className = "bubble-avatar";
    avatar.textContent = "\u{1F69A}";
    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
    row.appendChild(avatar);
    row.appendChild(indicator);
    msgs.appendChild(row);
    scrollDown();
    setTimeout(() => {
      row.remove();
      resolve();
    }, ms);
  });
}

function addOptions(options, callback) {
  const row = document.createElement("div");
  row.className = "options-row";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-btn";
    button.textContent = option;
    button.onclick = () => {
      row.remove();
      addUserMessage(option);
      callback(option);
    };
    row.appendChild(button);
  });
  msgs.appendChild(row);
  scrollDown();
}

function calcularRota() {
  const kmPorParada = 3 + Math.random() * 5;
  const distanciaTotal = (state.qtdParadas * kmPorParada).toFixed(1);
  const consumo = state.veiculo === "\u{1F6F5} Moto" ? 30 : 12;
  const litros = (distanciaTotal / consumo).toFixed(2);
  const custoComb = (litros * state.combustivel).toFixed(2);
  const adicionais = { "\u{1F4E6} Pequeno": 0, "\u{1F4E6} Médio": 5, "\u{1F4E6} Grande": 12 };
  const adicional = adicionais[state.tamanho] * state.qtdParadas;
  const minPorParada = 15 + Math.floor(Math.random() * 10);
  const tempoTotal = state.qtdParadas * minPorParada;
  const horas = Math.floor(tempoTotal / 60);
  const min = tempoTotal % 60;
  const tempoStr = horas > 0 ? `${horas}h ${min}min` : `${min}min`;
  const total = (parseFloat(custoComb) + adicional).toFixed(2);

  return { distanciaTotal, litros, custoComb, adicional, tempoStr, total };
}

async function botRespond(userText) {
  input.disabled = true;
  sendBtn.disabled = true;

  const txt = userText.trim().toLowerCase();

  if (state.step === "idle") {
    if (txt === "/novaentrega") {
      await showTyping(900);
      addMessage("bot", "\u{1F680} <strong>Nova entrega iniciada!</strong><br><br>Vamos calcular o custo do seu trajeto. Primeiro, me diga:<br><br>\u{1F4B0} Qual o <strong>preço do combustível</strong> na sua região? (R$/litro)<br><em>Ex: 5.89</em>", true);
      state.step = "combustivel";
    } else {
      await showTyping(700);
      addMessage("bot", "Para iniciar, digite <strong>/novaentrega</strong> \u{1F69A}", true);
    }
  } else if (state.step === "combustivel") {
    const value = parseFloat(txt.replace(",", "."));
    if (Number.isNaN(value) || value < 1 || value > 20) {
      await showTyping(700);
      addMessage("bot", "\u26A0\uFE0F Valor inválido. Digite o preço por litro. Ex: <strong>5.89</strong>", true);
    } else {
      state.combustivel = value;
      await showTyping(900);
      addMessage("bot", "\u{1F697} Qual o <strong>tipo de veículo</strong> que será usado na entrega?", true);
      addOptions(["\u{1F6F5} Moto", "\u{1F697} Carro"], handleOption);
      state.step = "veiculo";
      enableInput();
      return;
    }
  } else if (state.step === "veiculo") {
    if (txt.includes("moto") || txt.includes("carro")) {
      state.veiculo = userText;
      await showTyping(900);
      addMessage("bot", "\u{1F4E6} Qual o <strong>tamanho das mercadorias</strong>?", true);
      addOptions(["\u{1F4E6} Pequeno", "\u{1F4E6} Médio", "\u{1F4E6} Grande"], handleOption);
      state.step = "tamanho";
      enableInput();
      return;
    }
    await showTyping(600);
    addMessage("bot", "Por favor, selecione uma das opções abaixo \u{1F447}");
    addOptions(["\u{1F6F5} Moto", "\u{1F697} Carro"], handleOption);
    enableInput();
    return;
  } else if (state.step === "tamanho") {
    if (txt.includes("pequeno") || txt.includes("médio") || txt.includes("medio") || txt.includes("grande")) {
      if (txt.includes("pequeno")) {
        state.tamanho = "\u{1F4E6} Pequeno";
      } else if (txt.includes("grande")) {
        state.tamanho = "\u{1F4E6} Grande";
      } else {
        state.tamanho = "\u{1F4E6} Médio";
      }
      await showTyping(900);
      addMessage("bot", "\u{1F3EA} Qual o <strong>endereço da sua loja</strong>? (ponto de partida da entrega)<br><em>Ex: Rua das Flores, 123 – Centro</em>", true);
      state.step = "endereco_loja";
    } else {
      await showTyping(600);
      addMessage("bot", "Por favor, selecione uma das opções abaixo \u{1F447}");
      addOptions(["\u{1F4E6} Pequeno", "\u{1F4E6} Médio", "\u{1F4E6} Grande"], handleOption);
      enableInput();
      return;
    }
  } else if (state.step === "endereco_loja") {
    if (txt.length < 5) {
      await showTyping(600);
      addMessage("bot", "\u26A0\uFE0F Endereço muito curto. Tente novamente.");
    } else {
      state.enderecoLoja = userText;
      await showTyping(900);
      addMessage("bot", `\u2705 Loja registrada: <strong>${userText}</strong><br><br>\u{1F4CD} Quantas <strong>residências/pontos de entrega</strong> serão visitados?<br><em>Ex: 3</em>`, true);
      state.step = "qtd_paradas";
    }
  } else if (state.step === "qtd_paradas") {
    const qtd = parseInt(txt, 10);
    if (Number.isNaN(qtd) || qtd < 1 || qtd > 20) {
      await showTyping(700);
      addMessage("bot", "\u26A0\uFE0F Informe um número válido entre 1 e 20.");
    } else {
      state.qtdParadas = qtd;
      state.enderecos = [];
      state.enderecoAtual = 0;
      await showTyping(900);
      addMessage("bot", `\u{1F4EC} Ótimo! Vou precisar do endereço de cada cliente.<br><br>Digite o endereço do <strong>cliente 1</strong> de ${qtd}:`, true);
      state.step = "enderecos";
    }
  } else if (state.step === "enderecos") {
    if (txt.length < 5) {
      await showTyping(600);
      addMessage("bot", "\u26A0\uFE0F Endereço muito curto. Tente novamente.");
    } else {
      state.enderecos.push(userText);
      state.enderecoAtual++;
      if (state.enderecoAtual < state.qtdParadas) {
        await showTyping(800);
        addMessage("bot", `\u2705 Endereço ${state.enderecoAtual} registrado!<br><br>Agora o endereço do <strong>cliente ${state.enderecoAtual + 1}</strong> de ${state.qtdParadas}:`, true);
      } else {
        await showTyping(500);
        addMessage("bot", `\u2705 Todos os ${state.qtdParadas} endereços registrados!<br><br>\u{1F504} Calculando a melhor rota...`, true);
        state.step = "calculando";
        await showTyping(2200);

        const result = calcularRota();
        const endList = state.enderecos.map((address) => `<li>\u{1F4CD} ${address}</li>`).join("");
        const html = `
          <div class="result-card">
            <div class="result-title">\u{1F4CA} Relatório da Rota</div>
            <div class="result-row"><span class="result-label">\u{1F3EA} Ponto de partida</span><span class="result-value" style="font-size:12px;text-align:right;max-width:55%">${state.enderecoLoja}</span></div>
            <div class="result-row"><span class="result-label">\u{1F5FA}\uFE0F Distância estimada</span><span class="result-value">${result.distanciaTotal} km</span></div>
            <div class="result-row"><span class="result-label">\u26FD Combustível</span><span class="result-value">${result.litros}L · R$ ${result.custoComb}</span></div>
            <div class="result-row"><span class="result-label">\u{1F4E6} Adicional carga</span><span class="result-value">R$ ${result.adicional.toFixed(2)}</span></div>
            <div class="result-row"><span class="result-label">\u23F1\uFE0F Tempo estimado</span><span class="result-value">${result.tempoStr}</span></div>
            <div class="result-row"><span class="result-label">\u{1F3E0} Paradas</span><span class="result-value">${state.qtdParadas} entregas</span></div>
            <div class="result-row"><span class="result-label result-total">\u{1F4B0} Custo total estimado</span><span class="result-value result-total">R$ ${result.total}</span></div>
          </div>
          <br>\u{1F4CB} <strong>Endereços da rota:</strong><ul>${endList}</ul>
        `;
        addMessage("bot", html, true);

        await showTyping(1000);
        addMessage("bot", "\u2705 Rota calculada com sucesso! Boas entregas! \u{1F680}<br><br>Para calcular uma nova rota, digite <strong>/novaentrega</strong>.", true);

        Object.assign(state, {
          step: "idle",
          combustivel: null,
          veiculo: null,
          tamanho: null,
          enderecoLoja: null,
          qtdParadas: null,
          enderecos: [],
          enderecoAtual: 0
        });
      }
    }
  }

  enableInput();
}

function enableInput() {
  input.disabled = false;
  sendBtn.disabled = false;
  input.focus();
}

function handleOption(option) {
  botRespond(option);
}

function sendMessage() {
  const value = input.value.trim();
  if (!value) {
    return;
  }
  addUserMessage(value);
  input.value = "";
  botRespond(value);
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});
input.focus();
