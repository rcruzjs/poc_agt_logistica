/* =========================================================================
   LOGISTICS QUEST - RPG DASHBOARD CONTROL LOGIC (JS)
   ========================================================================= */

const API_BASE = window.location.origin + "/api";

// CAPACIDADES MÁXIMAS OPERACIONAIS PARA CÁLCULO DE BARRAS DE HP
const CAPACIDADES_REFERENCIA = {
    // Equipamentos
    "EQ-NOTE": 20,    // Laptops
    "EQ-PROJ": 10,    // Projetores
    "EQ-CAIX": 12,    // Caixas de Som
    "EQ-PASS": 15,    // Passadores de Slide
    "EQ-SUPT": 15,    // Suportes Articulados
    
    // Insumos
    "IN-CANE": 200,   // Canetas
    "IN-POST": 150,   // Post-its
    "IN-CRAC": 200,   // Crachás
    "IN-BLOC": 100,   // Blocos de Anotação
    "IN-PAST": 100    // Pastas Organizadoras
};

// Guardar estados para evitar redesenho desnecessário se nada mudou
let estadoAnterior = {
    total: -1,
    aSeparar: -1,
    emSeparacao: -1,
    emTreinamento: -1,
    reversas: -1
};

// ANIMAÇÃO DE INCREMENTO DE CONTADOR ESTILO RPG
function animarContador(id, valorFinal) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let valorInicial = parseInt(el.innerText) || 0;
    if (valorInicial === valorFinal) return;
    
    const duracao = 800; // ms
    const inicio = performance.now();
    
    function update(agora) {
        const decorrido = agora - inicio;
        const progresso = Math.min(decorrido / duracao, 1);
        
        // Efeito de desaceleração (easeOutQuad)
        const valorAtual = Math.floor(valorInicial + (valorFinal - valorInicial) * (progresso * (2 - progresso)));
        
        el.innerText = valorAtual;
        
        if (progresso < 1) {
            requestAnimationFrame(update);
        } else {
            el.innerText = valorFinal;
        }
    }
    
    requestAnimationFrame(update);
}

// BUSCAR DADOS DO BACKEND E ATUALIZAR
async function carregarDados() {
    try {
        // 1. Buscar Pedidos
        const resPedidos = await fetch(`${API_BASE}/pedidos`);
        if (!resPedidos.ok) throw new Error("Erro ao buscar pedidos.");
        const pedidos = await resPedidos.json();
        
        // 2. Buscar Estoque Físico Real
        const resEstoque = await fetch(`${API_BASE}/estoque`);
        if (!resEstoque.ok) throw new Error("Erro ao buscar estoque.");
        const estoqueRaw = await resEstoque.json();
        
        // Converter Array [{codigo, quantidade}] do backend para objeto de busca rápida {codigo: quantidade}
        const estoque = {};
        if (Array.isArray(estoqueRaw)) {
            estoqueRaw.forEach(item => {
                estoque[item.codigo] = item.quantidade;
            });
        }
        
        // 3. Buscar Definições para Mapeamento Visual de Descrições
        const resEquipamentos = await fetch(`${API_BASE}/equipamentos`);
        const equipamentosDef = resEquipamentos.ok ? await resEquipamentos.json() : [];
        
        const resInsumos = await fetch(`${API_BASE}/insumos`);
        const insumosDef = resInsumos.ok ? await resInsumos.json() : [];
        
        // --- PROCESSAR MÉTRICAS DE CONTEXTO ---
        const total = pedidos.length;
        
        // A Separar: status A_SEPARAR e Sem operador alocado
        const aSeparar = pedidos.filter(p => p.status_logistica === "A_SEPARAR" && !p.operador_separacao).length;
        
        // Em Separação: status A_SEPARAR e Com operador alocado
        const emSeparacao = pedidos.filter(p => p.status_logistica === "A_SEPARAR" && p.operador_separacao).length;
        
        // Em Treinamento (Em Andamento): status ENVIADO ou EM_TREINAMENTO
        const emTreinamento = pedidos.filter(p => ["ENVIADO", "EM_TREINAMENTO"].includes(p.status_logistica)).length;
        
        // Para Retornar (Reversa): status REVERSA_PENDENTE
        const reversas = pedidos.filter(p => p.status_logistica === "REVERSA_PENDENTE").length;
        
        // Atualizar com animação
        animarContador("val-total-treinamentos", total);
        animarContador("val-a-separar", aSeparar);
        animarContador("val-em-separacao", emSeparacao);
        animarContador("val-em-treinamento", emTreinamento);
        animarContador("val-reversas", reversas);
        
        // --- ATUALIZAR PIPELINE OPERACIONAL DE FLUXO ---
        atualizarPipeline(pedidos);
        
        // --- ATUALIZAR COFRE DO REINO (BARRAS DE HP DO ESTOQUE) ---
        renderizarEstoque("equipamentos-list", equipamentosDef, estoque, "Equipamento");
        renderizarEstoque("insumos-list", insumosDef, estoque, "Insumo");
        
    } catch (err) {
        console.error("Falha ao atualizar dados do RPG Dashboard:", err);
    }
}

// ATUALIZAÇÃO REATIVA DO PIPELINE E PARTÍCULAS EM MOVIMENTO
function atualizarPipeline(pedidos) {
    const total = pedidos.length;
    
    // 1. Demandas Criadas: todos os pedidos no sistema
    const totalCriados = total;
    
    // 2. Sem Operador: A_SEPARAR e sem operador
    const aSepararSemOperador = pedidos.filter(p => p.status_logistica === "A_SEPARAR" && !p.operador_separacao).length;
    
    // 3. Em Separação: A_SEPARAR e com operador
    const emSeparacaoComOperador = pedidos.filter(p => p.status_logistica === "A_SEPARAR" && p.operador_separacao).length;
    
    // 4. Em Trânsito / Campo: ENVIADO ou EM_TREINAMENTO
    const emCampo = pedidos.filter(p => ["ENVIADO", "EM_TREINAMENTO"].includes(p.status_logistica)).length;
    
    // 5. Logística Reversa: REVERSA_PENDENTE
    const reversas = pedidos.filter(p => p.status_logistica === "REVERSA_PENDENTE").length;

    // Atualizar indicadores numéricos dos estágios
    document.getElementById("count-stage-entrada").innerText = totalCriados;
    document.getElementById("count-stage-aguardando").innerText = aSepararSemOperador;
    document.getElementById("count-stage-separacao").innerText = emSeparacaoComOperador;
    document.getElementById("count-stage-treinamento").innerText = emCampo;
    document.getElementById("count-stage-reversa").innerText = reversas;

    // Alternar classes de brilho ativo nos nós
    toggleNodeActive("node-entrada", totalCriados > 0);
    toggleNodeActive("node-aguardando", aSepararSemOperador > 0);
    toggleNodeActive("node-separacao", emSeparacaoComOperador > 0);
    toggleNodeActive("node-treinamento", emCampo > 0);
    toggleNodeActive("node-reversa", reversas > 0);

    // Alternar fluxos e animação de partículas deslizantes
    // Fluxo 1: De "Criadas" para "Sem Operador" (Se houver pedidos aguardando alocação)
    toggleConnectorFlow("conn-c1", "particle-c1", totalCriados > 0 && aSepararSemOperador > 0, "conn-active-1", '<i class="fa-solid fa-file-signature"></i>');
    
    // Fluxo 2: De "Sem Operador" para "Em Separação" (Se houver equipe separando)
    toggleConnectorFlow("conn-c2", "particle-c2", aSepararSemOperador > 0 || emSeparacaoComOperador > 0, "conn-active-2", '<i class="fa-solid fa-box"></i>');
    
    // Fluxo 3: De "Em Separação" para "Em Trânsito" (Se houver materiais indo a campo)
    toggleConnectorFlow("conn-c3", "particle-c3", emSeparacaoComOperador > 0 || emCampo > 0, "conn-active-3", '<i class="fa-solid fa-truck"></i>');
    
    // Fluxo 4: De "Em Campo" para "Logística Reversa" (Se houver retornos pendentes)
    toggleConnectorFlow("conn-c4", "particle-c4", emCampo > 0 || reversas > 0, "conn-active-4", '<i class="fa-solid fa-arrow-rotate-left"></i>');
}

function toggleNodeActive(id, isActive) {
    const el = document.getElementById(id);
    if (!el) return;
    if (isActive) el.classList.add("node-active");
    else el.classList.remove("node-active");
}

function toggleConnectorFlow(connId, particleContainerId, isActive, activeColorClass, iconHtml) {
    const conn = document.getElementById(connId);
    const container = document.getElementById(particleContainerId);
    if (!conn || !container) return;

    if (isActive) {
        conn.classList.add("flow-active");
        conn.classList.add(activeColorClass);
        // Gerar partícula se estiver vazia
        if (container.children.length === 0) {
            container.innerHTML = `<div class="flow-particle flow-animate">${iconHtml}</div>`;
        }
    } else {
        conn.classList.remove("flow-active");
        conn.classList.remove(activeColorClass);
        container.innerHTML = "";
    }
}

// RENDERIZAR AS BARRAS DE HP DOS PRODUTOS
function renderizarEstoque(containerId, definicoes, estoqueAtual, tipo) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = "";
    
    if (definicoes.length === 0) {
        container.innerHTML = `<div class="loading-rpg">Nenhum item cadastrado no estoque.</div>`;
        return;
    }
    
    definicoes.forEach(item => {
        const codigo = item.codigo;
        const descricao = tipo === "Equipamento" ? item.descricao_do_equipamento : item.descricao_do_insumo;
        const saldo = estoqueAtual[codigo] !== undefined ? estoqueAtual[codigo] : 0;
        
        // Obter capacidade de referência para percentual
        const capMax = CAPACIDADES_REFERENCIA[codigo] || (tipo === "Equipamento" ? 15 : 100);
        const percentual = Math.min(Math.round((saldo / capMax) * 100), 100);
        
        // Escolher classe de cor com base no nível do Estoque
        let hpCorClass = "hp-green";
        if (percentual < 35) {
            hpCorClass = "hp-red"; // Estoque Crítico
        } else if (percentual < 70) {
            hpCorClass = "hp-yellow"; // Estoque Alerta
        }
        
        const cardDiv = document.createElement("div");
        cardDiv.className = "vault-item";
        cardDiv.innerHTML = `
            <div class="item-meta">
                <span class="item-name">${descricao} <small class="text-gold">[${codigo}]</small></span>
                <span class="item-qty-badge">${saldo} Unidades</span>
            </div>
            <div class="hp-container">
                <div class="hp-bar-outer">
                    <div class="hp-bar-inner ${hpCorClass}" style="width: ${percentual}%"></div>
                </div>
                <span class="hp-status-text ${hpCorClass}">${percentual}% CAP</span>
            </div>
        `;
        
        container.appendChild(cardDiv);
    });
}

// INICIALIZAR E AGENDAR LOOP DE ATUALIZAÇÃO
document.addEventListener("DOMContentLoaded", () => {
    carregarDados();
    // Atualiza automaticamente a cada 4 segundos para manter o game-loop dinâmico
    setInterval(carregarDados, 4000);
});
