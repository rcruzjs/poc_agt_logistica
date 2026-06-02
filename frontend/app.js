// =========================================================================
// MOTOR JAVASCRIPT V2 - ERP COMPLETO DE LOGÍSTICA & ESTOQUE
// =========================================================================

const API_BASE = "http://127.0.0.1:8000/api";

// Estado Global
let pedidos = [];
let treinamentos = [];
let consultores = [];
let equipamentos = [];
let insumos = [];
let kits = [];
let estoque = [];
let statusConexao = {};

document.addEventListener("DOMContentLoaded", () => {
    inicializarNavegacaoAbas();
    inicializarSubAbasCadastro();
    inicializarFormularios();
    inicializarModais();
    inicializarCronSimulations();
    
    // Carga inicial
    carregarDados();
});

// =========================================================================
// 1. NAVEGAÇÃO ENTRE ABAS PRINCIPAIS E SUB-ABAS
// =========================================================================

function inicializarNavegacaoAbas() {
    const menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(item => {
        item.addEventListener("click", () => {
            menuItems.forEach(mi => mi.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
            
            item.classList.add("active");
            const targetTab = item.getAttribute("data-tab");
            document.getElementById(`tab-${targetTab}`).classList.add("active");
            
            // Recarregar dados específicos ao entrar nas abas
            if (targetTab === "dashboard") carregarPedidos();
            if (targetTab === "estoque") {
                carregarEstoqueFisico();
                carregarComprasPreditivas();
            }
            if (targetTab === "cadastros") carregarTodosOsCadastros();
            if (targetTab === "status") carregarStatusConexao();
        });
    });
}

function inicializarSubAbasCadastro() {
    const subTabBtns = document.querySelectorAll(".sub-tab-btn");
    subTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            subTabBtns.forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".subtab-content").forEach(sc => sc.classList.remove("active"));
            
            btn.classList.add("active");
            const targetSub = btn.getAttribute("data-subtab");
            document.getElementById(`subtab-${targetSub}`).classList.add("active");
        });
    });
}

async function carregarDados() {
    try {
        await Promise.all([
            carregarStatusConexao(),
            carregarConsultores(),
            carregarTreinamentos(),
            carregarEquipamentos(),
            carregarInsumos(),
            carregarKits(),
            carregarPedidos(),
            carregarEstoqueFisico(),
            carregarComprasPreditivas()
        ]);
    } catch (e) {
        console.error("Erro ao sincronizar dados com o backend: ", e);
    }
}

async function carregarTodosOsCadastros() {
    await Promise.all([
        carregarConsultores(),
        carregarTreinamentos(),
        carregarEquipamentos(),
        carregarInsumos(),
        carregarKits()
    ]);
}

// =========================================================================
// 2. CONEXÃO COM AS APIS DO BACKEND (FASTAPI FETCH)
// =========================================================================

async function carregarStatusConexao() {
    try {
        const res = await fetch(`${API_BASE}/status`);
        statusConexao = await res.json();
        
        document.getElementById("conn-text").innerText = "Conectado ao Backend";
        document.getElementById("status-api").innerText = "ATIVO";
        document.getElementById("status-api").className = "status-badge green";
        
        document.getElementById("status-db").innerText = "JSON UNIFICADO";
        document.getElementById("status-db").className = "status-badge green";
        
        document.getElementById("status-ai").innerText = statusConexao.AI_STATUS.includes("Real") ? "VERTEX AI (ATIVO)" : "SIMULADO (LOCAL)";
        document.getElementById("status-ai").className = statusConexao.HAS_VERTEX ? "status-badge green" : "status-badge gray";
    } catch (e) {
        document.getElementById("conn-text").innerText = "Sem conexão com o Backend";
        document.getElementById("status-api").innerText = "OFFLINE";
        document.getElementById("status-api").className = "status-badge gray";
    }
}

async function carregarConsultores() {
    try {
        const res = await fetch(`${API_BASE}/consultores`);
        consultores = await res.json();
        
        // Renderizar na Tabela
        const tbody = document.getElementById("table-consultores");
        tbody.innerHTML = "";
        consultores.forEach(c => {
            tbody.innerHTML += `<tr><td><strong>${c.codigo}</strong></td><td>${c.nome}</td><td>${c.cpf}</td></tr>`;
        });
        
        // Atualizar seletor do modal de pedido
        const select = document.getElementById("p-consultor");
        select.innerHTML = '<option value="">Selecione o Consultor...</option>';
        consultores.forEach(c => {
            select.innerHTML += `<option value="${c.nome}">${c.nome} (CPF: ${c.cpf})</option>`;
        });
    } catch (e) { console.error(e); }
}

async function carregarTreinamentos() {
    try {
        const res = await fetch(`${API_BASE}/treinamentos`);
        treinamentos = await res.json();
        
        const tbody = document.getElementById("table-treinamentos");
        tbody.innerHTML = "";
        treinamentos.forEach(t => {
            tbody.innerHTML += `<tr><td><strong>${t.codigo}</strong></td><td>${t.descricao_do_treinamento}</td></tr>`;
        });
        
        // Atualizar seletor do modal de pedido
        const select = document.getElementById("p-treinamento-tipo");
        select.innerHTML = '<option value="">Selecione o Treinamento...</option>';
        treinamentos.forEach(t => {
            select.innerHTML += `<option value="${t.codigo}">${t.descricao_do_treinamento}</option>`;
        });
        
        // Atualizar seletor na subtab de composição de materiais
        const kSelect = document.getElementById("k-codigo");
        if (kSelect) {
            kSelect.innerHTML = '<option value="">Selecione o Treinamento...</option>';
            treinamentos.forEach(t => {
                kSelect.innerHTML += `<option value="${t.codigo}">${t.codigo} - ${t.descricao_do_treinamento}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function carregarEquipamentos() {
    try {
        const res = await fetch(`${API_BASE}/equipamentos`);
        equipamentos = await res.json();
        
        const tbody = document.getElementById("table-equipamentos");
        tbody.innerHTML = "";
        equipamentos.forEach(eq => {
            tbody.innerHTML += `<tr><td><strong>${eq.codigo}</strong></td><td>${eq.descricao_do_equipamento}</td><td>${eq.peso} kg</td><td>${eq.tamanho}</td></tr>`;
        });
        
        // Atualizar checkboxes de Kits
        const container = document.getElementById("k-equipamentos-checks");
        container.innerHTML = "";
        equipamentos.forEach(eq => {
            container.innerHTML += `
                <div class="checklist-item-flex" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center;">
                        <input type="checkbox" id="kit-eq-${eq.codigo}" value="${eq.codigo}" class="k-eq-checkbox" onchange="toggleQuantidadeInput('eq', '${eq.codigo}')">
                        <label for="kit-eq-${eq.codigo}" style="margin-left: 8px; font-size: 13px;"><strong>${eq.codigo}</strong> - ${eq.descricao_do_equipamento}</label>
                    </div>
                    <input type="number" id="kit-eq-qty-${eq.codigo}" min="1" max="10" value="1" disabled style="width: 50px; padding: 2px 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; text-align: center; font-size: 12px;">
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

async function carregarInsumos() {
    try {
        const res = await fetch(`${API_BASE}/insumos`);
        insumos = await res.json();
        
        const tbody = document.getElementById("table-insumos");
        tbody.innerHTML = "";
        insumos.forEach(ins => {
            tbody.innerHTML += `<tr><td><strong>${ins.codigo}</strong></td><td>${ins.descricao_do_insumo}</td></tr>`;
        });
        
        // Atualizar checkboxes de Kits
        const container = document.getElementById("k-insumos-checks");
        container.innerHTML = "";
        insumos.forEach(ins => {
            container.innerHTML += `
                <div class="checklist-item-flex" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center;">
                        <input type="checkbox" id="kit-ins-${ins.codigo}" value="${ins.codigo}" class="k-ins-checkbox" onchange="toggleQuantidadeInput('ins', '${ins.codigo}')">
                        <label for="kit-ins-${ins.codigo}" style="margin-left: 8px; font-size: 13px;"><strong>${ins.codigo}</strong> - ${ins.descricao_do_insumo}</label>
                    </div>
                    <input type="number" id="kit-ins-qty-${ins.codigo}" min="1" max="10" value="1" disabled style="width: 50px; padding: 2px 5px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; text-align: center; font-size: 12px;">
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

async function carregarKits() {
    try {
        const res = await fetch(`${API_BASE}/kits`);
        kits = await res.json();
        
        const tbody = document.getElementById("table-kits");
        tbody.innerHTML = "";
        kits.forEach(k => {
            const eqText = k.equipamentos && k.equipamentos.length > 0 ? k.equipamentos.map(eq => {
                const cod = eq.codigo || eq;
                const qty = eq.quantidade || 1;
                return `${cod} (${qty}x)`;
            }).join(", ") : "Nenhum";

            const insText = k.insumos && k.insumos.length > 0 ? k.insumos.map(ins => {
                const cod = ins.codigo || ins;
                const qty = ins.quantidade || 1;
                return `${cod} (${qty}x)`;
            }).join(", ") : "Nenhum";

            tbody.innerHTML += `
                <tr>
                    <td><strong>${k.codigo_do_kit}</strong></td>
                    <td>${k.descricao_do_kit}</td>
                    <td><span class="badge" style="background: rgba(0, 210, 255, 0.1); color: var(--color-primary);">${eqText}</span></td>
                    <td><span class="badge" style="background: rgba(5, 255, 200, 0.1); color: var(--color-success);">${insText}</span></td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

async function carregarEstoqueFisico() {
    try {
        const res = await fetch(`${API_BASE}/estoque`);
        estoque = await res.json();
        
        const tbody = document.getElementById("table-estoque");
        tbody.innerHTML = "";
        estoque.forEach(item => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${item.codigo}</strong></td>
                    <td>${item.descricao}</td>
                    <td><span class="badge">${item.tipo}</span></td>
                    <td><strong class="${item.quantidade === 0 ? 'text-danger' : 'text-success'}">${item.quantidade} un</strong></td>
                </tr>
            `;
        });
        
        // Atualizar dropdown do modal de Repor Estoque
        const select = document.getElementById("rep-item");
        select.innerHTML = '<option value="">Selecione o Item...</option>';
        
        // Unificar equipamentos e insumos
        equipamentos.forEach(eq => {
            select.innerHTML += `<option value="${eq.codigo}">[Equipamento] ${eq.codigo} - ${eq.descricao_do_equipamento}</option>`;
        });
        insumos.forEach(ins => {
            select.innerHTML += `<option value="${ins.codigo}">[Insumo] ${ins.codigo} - ${ins.descricao_do_insumo}</option>`;
        });
    } catch (e) { console.error(e); }
}

async function carregarComprasPreditivas() {
    try {
        const res = await fetch(`${API_BASE}/inteligencia/compras`);
        const data = await res.json();
        
        const tbody = document.getElementById("table-sugestoes-compras");
        tbody.innerHTML = "";
        
        if (data.sugestoes_compras.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-success text-center" style="padding: 30px;"><i class="fa-solid fa-circle-check"></i> Estoque perfeitamente abastecido para todos os pedidos ativos!</td></tr>`;
            return;
        }
        
        data.sugestoes_compras.forEach(s => {
            tbody.innerHTML += `
                <tr style="background: rgba(255, 71, 87, 0.02);">
                    <td><strong class="text-danger">${s.codigo}</strong></td>
                    <td>${s.descricao}</td>
                    <td>${s.demanda_total} un</td>
                    <td>${s.estoque_atual} un</td>
                    <td><strong style="color: var(--color-danger); text-shadow: 0 0 10px rgba(255,71,87,0.3);">${s.quantidade_a_comprar} un</strong></td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

async function carregarRastreabilidadeAtivos() {
    try {
        const res = await fetch(`${API_BASE}/inteligencia/rastreabilidade`);
        if (!res.ok) return;
        const data = await res.json();
        
        const tbody = document.getElementById("table-rastreabilidade");
        tbody.innerHTML = "";
        
        const alertaDiv = document.getElementById("alertas-prioridade-reversa");
        alertaDiv.innerHTML = "";
        alertaDiv.classList.add("hidden");
        
        let alertasHTML = "<strong><i class='fa-solid fa-triangle-exclamation'></i> Alertas de Prioridade de Coleta Reversa (IA):</strong><br>";
        let temAlerta = false;

        data.forEach(item => {
            // Se tem alerta, monta o texto e ativa
            if (item.alerta_prioridade) {
                temAlerta = true;
                alertasHTML += `&bull; ${item.mensagem_recomendacao}<br>`;
            }
            
            // Origens na rua amigável
            let origensHTML = "";
            if (item.pedidos_na_rua && item.pedidos_na_rua.length > 0) {
                origensHTML = item.pedidos_na_rua.map(o => {
                    const statusClass = o.status === "REVERSA_PENDENTE" ? "text-warning" : "text-success";
                    return `<span style="font-size: 11px; display: block;">Local: ${o.local} (Pedido #${o.id_pedido} - <span class="${statusClass}">${o.status.replace("_", " ")}</span>)</span>`;
                }).join("");
            } else {
                origensHTML = "<span class='text-muted' style='font-size: 11px;'>Todos em casa</span>";
            }
            
            // Se está com alerta, destaca a linha
            const styleLinha = item.alerta_prioridade ? "background: rgba(255, 165, 2, 0.02); font-weight: 500;" : "";
            
            const badgeTipo = item.tipo === "Equipamento" ? "background: rgba(0, 210, 255, 0.05); color: var(--color-primary);" : "background: rgba(5, 255, 200, 0.05); color: var(--color-success);";

            tbody.innerHTML += `
                <tr style="${styleLinha}">
                    <td><strong>${item.codigo}</strong></td>
                    <td>${item.descricao}</td>
                    <td><span class="badge" style="${badgeTipo}">${item.tipo}</span></td>
                    <td class="text-center" style="text-align: center;"><strong class="text-success">${item.em_casa} un</strong></td>
                    <td class="text-center" style="text-align: center;"><strong class="${item.na_rua > 0 ? 'text-primary' : 'text-muted'}">${item.na_rua} un</strong></td>
                    <td class="text-center" style="text-align: center;"><strong class="${item.demanda_futura > 0 ? 'text-warning' : 'text-muted'}">${item.demanda_futura} un</strong></td>
                    <td>
                        ${item.alerta_prioridade ? `<span class="badge text-warning" style="background: rgba(255,165,2,0.1); display: inline-block; margin-bottom: 4px;"><i class="fa-solid fa-bell"></i> PRIORIZAR REVERSA</span>` : ""}
                        ${origensHTML}
                    </td>
                </tr>
            `;
        });
        
        if (temAlerta) {
            alertaDiv.innerHTML = alertasHTML;
            alertaDiv.classList.remove("hidden");
        }
    } catch (e) {
        console.error("Erro ao carregar dados de rastreabilidade de ativos:", e);
    }
}

async function carregarPedidos() {
    try {
        const res = await fetch(`${API_BASE}/pedidos`);
        pedidos = await res.json();
        
        renderizarKPIs();
        renderizarKanban();
        carregarRastreabilidadeAtivos();
        
        // Se estiver na aba estoque, atualizar a IA de suprimentos também
        if (document.getElementById("tab-estoque").classList.contains("active")) {
            carregarEstoqueFisico();
            carregarComprasPreditivas();
        }
    } catch (e) { console.error(e); }
}

// =========================================================================
// 3. RENDERIZAÇÃO KPIs & KANBAN V2
// =========================================================================

function renderizarKPIs() {
    document.getElementById("kpi-total-pedidos").innerText = pedidos.length;
    
    const violados = pedidos.filter(p => p.sla_violado).length;
    const rate = pedidos.length > 0 ? Math.round((violados / pedidos.length) * 100) : 0;
    document.getElementById("kpi-sla-rate").innerText = `${rate}%`;
    
    const depreciacaoTotal = pedidos.reduce((acc, p) => acc + (p.reversa_custo_perda || 0), 0);
    document.getElementById("kpi-depreciacao").innerText = `R$ ${depreciacaoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderizarKanban() {
    const colSeparar = document.getElementById("column-a-separar");
    const colEnviado = document.getElementById("column-enviado");
    const colReversa = document.getElementById("column-reversa");
    const colConcluido = document.getElementById("column-concluido");
    
    colSeparar.innerHTML = "";
    colEnviado.innerHTML = "";
    colReversa.innerHTML = "";
    colConcluido.innerHTML = "";
    
    let countSeparar = 0, countEnviado = 0, countReversa = 0, countConcluido = 0;
    
    pedidos.forEach(p => {
        const card = document.createElement("div");
        card.className = "card-item";
        
        const tagClass = p.sla_violado ? "violado" : "cumprido";
        const tagText = p.sla_violado ? "SLA Violado" : "SLA OK";
        
        let cardHTML = `
            <div class="card-item-body">
                <div class="card-header-info">
                    <span class="card-id">#${p.id_pedido}</span>
                    <span class="card-tag ${tagClass}">${tagText}</span>
                </div>
                <h4>${p.consultor_nome}</h4>
                <div class="card-detail">
                    <i class="fa-solid fa-graduation-cap"></i>
                    <span>${p.kit_tipo}</span>
                </div>
                <div class="card-detail">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>Local: ${p.local}</span>
                </div>
                <div class="card-detail">
                    <i class="fa-solid fa-calendar-days"></i>
                    <span>Data: ${p.data_treinamento}</span>
                </div>
        `;
        
        if (p.novos_insumos_solicitados) {
            cardHTML += `
                <div class="card-detail font-weight-500" style="color: var(--color-warning);">
                    <i class="fa-solid fa-circle-plus"></i>
                    <span>Insumos extras: ${p.novos_insumos_solicitados}</span>
                </div>
            `;
        }

        const status = p.status_logistica;
        if (status === "A_SEPARAR") {
            countSeparar++;
            
            // Exibir quem está separando o pedido
            if (p.operador_separacao) {
                cardHTML += `
                    <div class="card-detail mt-2 font-weight-500" style="color: var(--color-success); border-top: 1px solid rgba(255,255,255,0.03); padding-top: 6px;">
                        <i class="fa-solid fa-user-gear"></i>
                        <span>Separador: <strong>${p.operador_separacao}</strong></span>
                    </div>
                `;
            } else {
                cardHTML += `
                    <div class="card-detail mt-2 font-weight-500 text-muted" style="border-top: 1px solid rgba(255,255,255,0.03); padding-top: 6px;">
                        <i class="fa-solid fa-user-lock"></i>
                        <span>Separador: <strong>Não alocado</strong></span>
                    </div>
                    <button class="btn btn-secondary btn-xs btn-block mt-2" style="font-size: 10px; padding: 4px; background: rgba(255, 165, 2, 0.05); color: var(--color-warning); border-color: rgba(255, 165, 2, 0.15);" onclick="assumirSeparacao('${p.id_pedido}')">
                        <i class="fa-solid fa-hand-holding-hand"></i> Assumir Separação
                    </button>
                `;
            }

            cardHTML += `
                <div class="card-actions mt-2">
                    <button class="btn btn-primary btn-sm" onclick="abrirExpedicao('${p.id_pedido}')" ${!p.operador_separacao ? 'disabled style="opacity: 0.5; cursor: not-allowed;" title="Assuma a separação primeiro"' : ''}>
                        <i class="fa-solid fa-truck-ramp-box"></i> Despachar Kit
                    </button>
                </div>
            `;
            card.innerHTML = cardHTML + `</div>`;
            colSeparar.appendChild(card);
            
        } else if (status === "ENVIADO" || status === "EM_TREINAMENTO") {
            countEnviado++;
            cardHTML += `
                <div class="card-detail mt-2 text-primary font-weight-500">
                    <i class="fa-solid fa-truck"></i>
                    <span class="text-success">Em Trânsito / Evento</span>
                </div>
            `;
            card.innerHTML = cardHTML + `</div>`;
            colEnviado.appendChild(card);
            
        } else if (status === "REVERSA_PENDENTE") {
            countReversa++;
            cardHTML += `
                <div class="card-actions">
                    <button class="btn btn-sm btn-primary" style="background: linear-gradient(135deg, var(--color-warning), #ffa502);" onclick="abrirTriagem('${p.id_pedido}')">
                        <i class="fa-solid fa-clipboard-check"></i> Fazer Triagem
                    </button>
                </div>
            `;
            card.innerHTML = cardHTML + `</div>`;
            colReversa.appendChild(card);
            
        } else if (status === "CONCLUIDO") {
            countConcluido++;
            
            const condicaoIcon = p.reversa_condicao_material === "100_INTEGRO" ? "fa-circle-check text-success" : "fa-triangle-exclamation text-danger";
            const condicaoText = p.reversa_condicao_material.replace("_", " ");
            
            cardHTML += `
                <div class="card-detail mt-2" style="border-top: 1px solid rgba(255,255,255,0.03); padding-top: 8px;">
                    <i class="fa-solid ${condicaoIcon}"></i>
                    <span>Físico: <strong>${condicaoText}</strong></span>
                </div>
                <div class="card-detail">
                    <i class="fa-solid fa-clock"></i>
                    <span>Retorno: <strong>${p.reversa_status_retorno.replace("_", " ")}</strong></span>
                </div>
                <div class="card-detail font-weight-600 text-danger">
                    <i class="fa-solid fa-dollar-sign"></i>
                    <span>Perda: R$ ${p.reversa_custo_perda.toFixed(2)}</span>
                </div>
            `;
            card.innerHTML = cardHTML + `</div>`;
            colConcluido.appendChild(card);
        }
    });
    
    document.getElementById("badge-a-separar").innerText = countSeparar;
    document.getElementById("badge-enviado").innerText = countEnviado;
    document.getElementById("badge-reversa").innerText = countReversa;
    document.getElementById("badge-concluido").innerText = countConcluido;
}

// =========================================================================
// 4. PREENCHIMENTO AUTOMÁTICO DE MATERIAIS DO KIT (Seção B)
// =========================================================================

window.autoPreencherMateriaisDoTreinamento = () => {
    const treinoCodigo = document.getElementById("p-treinamento-tipo").value;
    const treino = treinamentos.find(t => t.codigo === treinoCodigo);
    
    const eqDiv = document.getElementById("p-kit-equipamentos-itens");
    const insDiv = document.getElementById("p-kit-insumos-itens");
    
    if (!treino) {
        eqDiv.innerHTML = "Nenhum treinamento selecionado.";
        insDiv.innerHTML = "";
        return;
    }
    
    eqDiv.innerHTML = `<span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 6px;">⚙️ Equipamentos do Pedido (Ajuste a Qtd.)</span>`;
    if (treino.equipamentos && treino.equipamentos.length > 0) {
        treino.equipamentos.forEach(eq => {
            const cod = eq.codigo || eq;
            const qty = eq.quantidade || 1;
            eqDiv.innerHTML += `
                <div class="checklist-item-flex" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <div style="display: flex; align-items: center;">
                        <input type="checkbox" id="p-eq-${cod}" value="${cod}" class="p-eq-checkbox" checked onchange="togglePedidoQtyInput('eq', '${cod}')">
                        <label for="p-eq-${cod}" style="margin-left: 8px; font-size: 12px;"><strong>${cod}</strong></label>
                    </div>
                    <input type="number" id="p-eq-qty-${cod}" min="1" max="10" value="${qty}" style="width: 45px; padding: 1px 3px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.25); color: #fff; text-align: center; font-size: 11px;">
                </div>
            `;
        });
    } else {
        eqDiv.innerHTML += `<span class='text-muted' style='font-size: 11px; display: block; margin-bottom: 6px;'>Nenhum equipamento cadastrado</span>`;
    }

    insDiv.innerHTML = `<span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block; margin-top: 6px; margin-bottom: 6px;">📝 Insumos do Pedido (Ajuste a Qtd.)</span>`;
    if (treino.insumos && treino.insumos.length > 0) {
        treino.insumos.forEach(ins => {
            const cod = ins.codigo || ins;
            const qty = ins.quantidade || 1;
            insDiv.innerHTML += `
                <div class="checklist-item-flex" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <div style="display: flex; align-items: center;">
                        <input type="checkbox" id="p-ins-${cod}" value="${cod}" class="p-ins-checkbox" checked onchange="togglePedidoQtyInput('ins', '${cod}')">
                        <label for="p-ins-${cod}" style="margin-left: 8px; font-size: 12px;"><strong>${cod}</strong></label>
                    </div>
                    <input type="number" id="p-ins-qty-${cod}" min="1" max="10" value="${qty}" style="width: 45px; padding: 1px 3px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.25); color: #fff; text-align: center; font-size: 11px;">
                </div>
            `;
        });
    } else {
        insDiv.innerHTML += `<span class='text-muted' style='font-size: 11px; display: block; margin-bottom: 6px;'>Nenhum insumo cadastrado</span>`;
    }
};
window.autoPreencherMateriaisDoKit = window.autoPreencherMateriaisDoTreinamento;

// =========================================================================
// 5. PROCESSAMENTO DE FORMULÁRIOS DE CRUDS (Seção A)
// =========================================================================

function inicializarFormularios() {
    // 1. Consultores
    document.getElementById("form-consultor").addEventListener("submit", async (e) => {
        e.preventDefault();
        const codigo = document.getElementById("c-codigo").value;
        const nome = document.getElementById("c-nome").value;
        const cpf = document.getElementById("c-cpf").value;
        
        try {
            const res = await fetch(`${API_BASE}/consultores`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo, nome, cpf })
            });
            if (res.ok) {
                alert("Consultor cadastrado com sucesso!");
                document.getElementById("form-consultor").reset();
                carregarConsultores();
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail}`);
            }
        } catch (err) { console.error(err); }
    });

    // 2. Treinamentos
    document.getElementById("form-treinamento").addEventListener("submit", async (e) => {
        e.preventDefault();
        const codigo = document.getElementById("t-codigo").value;
        const descricao_do_treinamento = document.getElementById("t-descricao").value;
        
        try {
            const res = await fetch(`${API_BASE}/treinamentos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo, descricao_do_treinamento })
            });
            if (res.ok) {
                alert("Treinamento cadastrado com sucesso!");
                document.getElementById("form-treinamento").reset();
                carregarTreinamentos();
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail}`);
            }
        } catch (err) { console.error(err); }
    });

    // 3. Equipamentos
    document.getElementById("form-equipamento").addEventListener("submit", async (e) => {
        e.preventDefault();
        const codigo = document.getElementById("eq-codigo").value;
        const descricao_do_equipamento = document.getElementById("eq-desc").value;
        const peso = parseFloat(document.getElementById("eq-peso").value);
        const tamanho = document.getElementById("eq-tamanho").value;
        
        try {
            const res = await fetch(`${API_BASE}/equipamentos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo, descricao_do_equipamento, peso, tamanho })
            });
            if (res.ok) {
                alert("Equipamento cadastrado!");
                document.getElementById("form-equipamento").reset();
                carregarEquipamentos();
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail}`);
            }
        } catch (err) { console.error(err); }
    });

    // 4. Insumos
    document.getElementById("form-insumo").addEventListener("submit", async (e) => {
        e.preventDefault();
        const codigo = document.getElementById("ins-codigo").value;
        const descricao_do_insumo = document.getElementById("ins-desc").value;
        
        try {
            const res = await fetch(`${API_BASE}/insumos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo, descricao_do_insumo })
            });
            if (res.ok) {
                alert("Insumo cadastrado!");
                document.getElementById("form-insumo").reset();
                carregarInsumos();
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail}`);
            }
        } catch (err) { console.error(err); }
    });

    // 5. Configurar Composições de Treinamento (Com validações de limite de 5 eq e 3 ins)
    document.getElementById("form-kit").addEventListener("submit", async (e) => {
        e.preventDefault();
        const codigo_do_kit = document.getElementById("k-codigo").value;
        const descricao_do_kit = document.getElementById("k-desc").value;
        
        // Pegar equipamentos marcados e suas quantidades
        const eqChecks = document.querySelectorAll(".k-eq-checkbox:checked");
        const equipamentos_selecionados = Array.from(eqChecks).map(cb => {
            const cod = cb.value;
            const qty = parseInt(document.getElementById(`kit-eq-qty-${cod}`).value) || 1;
            return { codigo: cod, quantidade: qty };
        });
        
        // Pegar insumos marcados e suas quantidades
        const insChecks = document.querySelectorAll(".k-ins-checkbox:checked");
        const insumos_selecionados = Array.from(insChecks).map(cb => {
            const cod = cb.value;
            const qty = parseInt(document.getElementById(`kit-ins-qty-${cod}`).value) || 1;
            return { codigo: cod, quantidade: qty };
        });
        
        const totalEqQtd = equipamentos_selecionados.reduce((acc, eq) => acc + eq.quantidade, 0);
        const totalInsQtd = insumos_selecionados.reduce((acc, ins) => acc + ins.quantidade, 0);
        
        if (totalEqQtd > 5) {
            alert("Erro: A composição pode conter no máximo 5 unidades de equipamentos!");
            return;
        }
        if (totalInsQtd > 3) {
            alert("Erro: A composição pode conter no máximo 3 unidades de insumos!");
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE}/kits`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    codigo_do_kit,
                    descricao_do_kit,
                    equipamentos: equipamentos_selecionados,
                    insumos: insumos_selecionados
                })
            });
            if (res.ok) {
                alert("Composição do treinamento salva com sucesso!");
                document.getElementById("form-kit").reset();
                carregarKits();
            } else {
                const err = await res.json();
                alert(`Erro: ${err.detail}`);
            }
        } catch (err) { console.error(err); }
    });

    // 6. Criar Pedido (Seção B)
    const formPedido = document.getElementById("form-pedido");
    formPedido.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const consultor = document.getElementById("p-consultor").value;
        const treinamentoCodigo = document.getElementById("p-treinamento-tipo").value;
        const data = document.getElementById("p-data").value;
        const alunos = document.getElementById("p-alunos").value;
        const local = document.getElementById("p-local").value;
        const insumosExtras = document.getElementById("p-insumos-extras").value;
        const justificativa = document.getElementById("p-justificativa").value;
        
        const treino = treinamentos.find(t => t.codigo === treinamentoCodigo);
        if (!treino) return;
        
        // Obter equipamentos selecionados e suas quantidades na tela do pedido!
        const eqChecks = document.querySelectorAll(".p-eq-checkbox:checked");
        const eqLista = [];
        eqChecks.forEach(cb => {
            const cod = cb.value;
            const qty = parseInt(document.getElementById(`p-eq-qty-${cod}`).value) || 1;
            for (let i = 0; i < qty; i++) {
                eqLista.push(cod);
            }
        });

        // Obter insumos selecionados e suas quantidades na tela do pedido!
        const insChecks = document.querySelectorAll(".p-ins-checkbox:checked");
        const insLista = [];
        insChecks.forEach(cb => {
            const cod = cb.value;
            const qty = parseInt(document.getElementById(`p-ins-qty-${cod}`).value) || 1;
            for (let i = 0; i < qty; i++) {
                insLista.push(cod);
            }
        });
        
        const payload = {
            consultor_nome: consultor,
            data_treinamento: data,
            kit_tipo: treino.codigo,
            quantidade_alunos: alunos,
            local: local,
            lista_de_equipamentos: eqLista,
            lista_de_insumos: insLista,
            novos_insumos_solicitados: insumosExtras,
            justificativa: justificativa || null
        };
        
        try {
            const res = await fetch(`${API_BASE}/pedidos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            const result = await res.json();
            
            if (!res.ok) {
                alert(`Rejeição do Agente: ${result.detail}`);
                return;
            }
            
            if (result.status === "EXIGE_JUSTIFICATIVA") {
                document.getElementById("sla-warning-msg").innerText = result.mensagem;
                document.getElementById("sla-warning").classList.remove("hidden");
                
                document.getElementById("group-justificativa").classList.remove("hidden");
                document.getElementById("p-justificativa").required = true;
                document.getElementById("p-justificativa").focus();
                
                document.getElementById("btn-submit-pedido").innerText = "Confirmar Justificativa";
            } else if (result.status === "CRIADO") {
                alert(result.mensagem);
                fecharModal("modal-pedido");
                carregarPedidos();
            }
        } catch (err) { alert("Erro ao contatar o Agente do SLA: " + err); }
    });

    // 7. Despacho do Estoque (Agente 2)
    document.getElementById("form-expedicao").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id_pedido = document.getElementById("exp-id-pedido").value;
        const codigo_rastreio = document.getElementById("exp-rastreio").value;
        
        const checkboxes = document.querySelectorAll("#exp-checklist-group input[type='checkbox']");
        const checklists_confirmados = [];
        checkboxes.forEach(cb => {
            if (cb.checked) checklists_confirmados.push(cb.value);
        });
        
        try {
            const res = await fetch(`${API_BASE}/pedidos/${id_pedido}/despachar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ checklists_confirmados, codigo_rastreio })
            });
            
            const result = await res.json();
            
            if (res.ok) {
                alert(result.mensagem);
                fecharModal("modal-expedicao");
                carregarPedidos();
            } else {
                alert(`Bloqueio do Agente: ${result.detail}`);
            }
        } catch (err) { alert("Erro ao despachar: " + err); }
    });

    // 8. Retorno do Treinamento e Triagem (Seção C)
    document.getElementById("form-triagem").addEventListener("submit", async (e) => {
        e.preventDefault();
        const id_pedido = document.getElementById("tria-id-pedido").value;
        
        const local_retirada = document.getElementById("tria-local-retirada").value;
        const data_retirada = document.getElementById("tria-data-retirada").value;
        const hora_retirada = document.getElementById("tria-hora-retirada").value;
        
        const atrasado = document.querySelector("input[name='tria-atrasado']:checked").value === "sim";
        const responsabilidade_atraso = atrasado ? document.getElementById("tria-culpa").value : "";
        const avariado = document.querySelector("input[name='tria-avariado']:checked").value === "sim";
        const itens_faltantes = document.querySelector("input[name='tria-faltantes']:checked").value === "sim";
        const custo_estimado = (avariado || itens_faltantes) ? parseFloat(document.getElementById("tria-custo").value) : 0.0;
        
        const payload = {
            local_retirada,
            data_retirada,
            hora_retirada,
            atrasado,
            responsabilidade_atraso,
            avariado,
            itens_faltantes,
            custo_estimado
        };
        
        try {
            const res = await fetch(`${API_BASE}/pedidos/${id_pedido}/triagem`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            const result = await res.json();
            
            if (res.ok) {
                alert(result.mensagem);
                fecharModal("modal-triagem");
                carregarPedidos();
            } else {
                alert(`Erro na Triagem: ${result.detail}`);
            }
        } catch (err) { alert("Erro de comunicação com o Agente 3: " + err); }
    });

    // 9. Repor Estoque Físico
    document.getElementById("form-repor-estoque").addEventListener("submit", async (e) => {
        e.preventDefault();
        const codigo_item = document.getElementById("rep-item").value;
        const quantidade = parseInt(document.getElementById("rep-quantidade").value);
        
        try {
            const res = await fetch(`${API_BASE}/estoque/repor`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo_item, quantidade })
            });
            if (res.ok) {
                alert("Saldo físico do item reposto com sucesso!");
                fecharModal("modal-repor-estoque");
                carregarEstoqueFisico();
            } else {
                alert("Erro ao repor item.");
            }
        } catch (err) { console.error(err); }
    });
}

// =========================================================================
// 6. CONTROLE DE MODAIS (EXPEDIÇÃO DINÂMICA BASEADA NO KIT)
// =========================================================================

function inicializarModais() {
    window.fecharModal = (id) => {
        document.getElementById(id).classList.remove("active");
    };
    
    window.abrirModal = (id) => {
        document.getElementById(id).classList.add("active");
    };
    
    document.getElementById("btn-novo-pedido").addEventListener("click", () => {
        document.getElementById("form-pedido").reset();
        document.getElementById("p-composição-do-kit-display").innerHTML = '<span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Composição Padrão Selecionada</span><div id="p-kit-equipamentos-itens" class="text-xs mt-2" style="font-size: 12px;">Nenhum kit selecionado.</div><div id="p-kit-insumos-itens" class="text-xs mt-1" style="font-size: 12px;"></div>';
        document.getElementById("sla-warning").classList.add("hidden");
        document.getElementById("group-justificativa").classList.add("hidden");
        document.getElementById("p-justificativa").required = false;
        document.getElementById("btn-submit-pedido").innerText = "Validar e Solicitar";
        abrirModal("modal-pedido");
    });
}

window.abrirReporEstoque = () => {
    document.getElementById("form-repor-estoque").reset();
    abrirModal("modal-repor-estoque");
};

window.abrirExpedicao = (id_pedido) => {
    const pedido = pedidos.find(p => p.id_pedido === id_pedido);
    if (!pedido) return;
    
    document.getElementById("exp-id-pedido").value = id_pedido;
    document.getElementById("exp-id-display").innerText = `#${id_pedido}`;
    document.getElementById("exp-rastreio").value = "";
    
    const checklistGrupo = document.getElementById("exp-checklist-group");
    checklistGrupo.innerHTML = "";
    
    // Itens mandatórios exigidos pelo Agente 2 (Auditor)
    const itensMandatorios = [
        "Canetas conferidas",
        "Crachás impressos",
        "Post-its contados",
        "Protocolo físico assinado"
    ];
    
    // Auxiliar para obter descrição amigável do catálogo
    function obterDescricaoMaterial(codigo) {
        const eq = (equipamentos || []).find(e => e.codigo === codigo);
        if (eq) return eq.descricao_do_equipamento;
        const ins = (insumos || []).find(i => i.codigo === codigo);
        if (ins) return ins.descricao_do_insumo;
        return codigo;
    }
    
    // Obter os itens do pedido
    const eqItens = pedido.lista_de_equipamentos || [];
    const insItens = pedido.lista_de_insumos || [];
    const todosItens = [...eqItens, ...insItens];
    
    // Adicionar seção de Conformidade Operacional (Mandatórios)
    const headerMandatorios = document.createElement("div");
    headerMandatorios.style.fontWeight = "bold";
    headerMandatorios.style.color = "var(--primary-color)";
    headerMandatorios.style.marginTop = "10px";
    headerMandatorios.style.marginBottom = "8px";
    headerMandatorios.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
    headerMandatorios.style.paddingBottom = "4px";
    headerMandatorios.innerText = "📋 Conformidade Operacional (Auditoria Agente 2)";
    checklistGrupo.appendChild(headerMandatorios);
    
    itensMandatorios.forEach((item, idx) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "checklist-item";
        itemDiv.innerHTML = `
            <input type="checkbox" id="cb-mand-${idx}" value="${item}">
            <label for="cb-mand-${idx}">Conferência física de: <strong>${item}</strong></label>
        `;
        checklistGrupo.appendChild(itemDiv);
    });
    
    // Agrupar itens repetidos para exibição limpa com quantidades
    const contagemItens = {};
    todosItens.forEach(item => {
        contagemItens[item] = (contagemItens[item] || 0) + 1;
    });
    
    const itensUnicos = Object.keys(contagemItens);
    
    // Se houver itens específicos no pedido, listar também para conferência do operador
    if (itensUnicos.length > 0) {
        const headerItens = document.createElement("div");
        headerItens.style.fontWeight = "bold";
        headerItens.style.color = "#00e5ff";
        headerItens.style.marginTop = "18px";
        headerItens.style.marginBottom = "8px";
        headerItens.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
        headerItens.style.paddingBottom = "4px";
        headerItens.innerText = "📦 Conferência de Materiais do Pedido";
        checklistGrupo.appendChild(headerItens);
        
        itensUnicos.forEach((codigo, idx) => {
            const qtd = contagemItens[codigo];
            const descricao = obterDescricaoMaterial(codigo);
            const itemDiv = document.createElement("div");
            itemDiv.className = "checklist-item";
            itemDiv.innerHTML = `
                <input type="checkbox" id="cb-item-${idx}" value="${codigo}">
                <label for="cb-item-${idx}">Conferência física de: <strong>${descricao} (${qtd} un)</strong></label>
            `;
            checklistGrupo.appendChild(itemDiv);
        });
    }
    
    abrirModal("modal-expedicao");
};

window.abrirTriagem = (id_pedido) => {
    document.getElementById("tria-id-pedido").value = id_pedido;
    document.getElementById("tria-id-display").innerText = `#${id_pedido}`;
    
    document.getElementById("tria-local-retirada").value = "";
    document.getElementById("tria-data-retirada").value = new Date().toISOString().split("T")[0];
    document.getElementById("tria-hora-retirada").value = new Date().toTimeString().slice(0, 5);
    
    document.querySelector("input[name='tria-atrasado'][value='nao']").checked = true;
    document.querySelector("input[name='tria-avariado'][value='nao']").checked = true;
    document.querySelector("input[name='tria-faltantes'][value='nao']").checked = true;
    document.getElementById("tria-custo").value = "0.00";
    
    toggleAtrasoGroup(false);
    toggleCustoGroup(false);
    
    abrirModal("modal-triagem");
};

window.toggleAtrasoGroup = (mostrar) => {
    const grp = document.getElementById("tria-atraso-grupo");
    if (mostrar) grp.classList.remove("hidden");
    else grp.classList.add("hidden");
};

window.toggleCustoGroup = () => {
    const avariado = document.querySelector("input[name='tria-avariado']:checked").value === "sim";
    const faltantes = document.querySelector("input[name='tria-faltantes']:checked").value === "sim";
    
    const grp = document.getElementById("tria-custo-grupo");
    if (avariado || faltantes) grp.classList.remove("hidden");
    else grp.classList.add("hidden");
};

// =========================================================================
// 7. SIMULAÇÃO DE CRONS (BALANCEADOR DE QUARTA E GATILHOS REVERSA)
// =========================================================================

function inicializarCronSimulations() {
    // 1. Cron Balanceador Preditivo
    document.getElementById("btn-cron-quarta").addEventListener("click", async () => {
        let url = `${API_BASE}/pedidos/cron-quarta`;
        
        try {
            const res = await fetch(url, { method: "POST" });
            const result = await res.json();
            
            if (res.ok) {
                alert(result.mensagem);
                if (result.ACTION === "TRIGGER_PRE_MONTAGEM_PREVENTIVA") {
                    document.getElementById("alerta-balanceador-msg").innerText = result.mensagem;
                    const checklistDiv = document.getElementById("alerta-balanceador-checklist");
                    checklistDiv.innerHTML = "<strong>Itens Recomendados para Separação Prévia:</strong><br>";
                    result.checklist_obrigatorio.forEach(item => {
                        checklistDiv.innerHTML += ` &bull; ${item}<br>`;
                    });
                    document.getElementById("alerta-balanceador").classList.remove("hidden");
                }
            }
        } catch (err) { alert(err); }
    });

    // 2. Cron Pós-Evento Reversa
    document.getElementById("btn-cron-reversa").addEventListener("click", async () => {
        const dataSimular = prompt("Para simular o gatilho pós-evento, digite a data fictícia (AAAA-MM-DD).\nO Agente moverá automaticamente treinamentos concluídos no dia anterior para a logística de devolução física.");
        if (dataSimular === null) return;
        
        let url = `${API_BASE}/pedidos/cron-reversa`;
        if (dataSimular !== "") {
            url += `?data_simulada=${dataSimular}`;
        }
        
        try {
            const res = await fetch(url, { method: "POST" });
            const result = await res.json();
            if (res.ok) {
                alert(result.mensagem);
                carregarPedidos();
            } else {
                alert("Erro ao rodar cron: " + result.detail);
            }
        } catch (err) { alert(err); }
    });
}

window.fecharAlerta = () => {
    document.getElementById("alerta-balanceador").classList.add("hidden");
};

window.assumirSeparacao = async (id_pedido) => {
    const operador = prompt("Digite seu nome / operador responsável pela separação física:");
    if (!operador || operador.trim() === "") return;
    
    try {
        const res = await fetch(`${API_BASE}/pedidos/${id_pedido}/assumir`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operador })
        });
        
        if (res.ok) {
            alert("Você assumiu a separação deste pedido!");
            carregarPedidos();
        } else {
            const err = await res.json();
            alert(`Erro ao alocar operador: ${err.detail}`);
        }
    } catch (err) { console.error(err); }
};

window.toggleQuantidadeInput = (tipo, codigo) => {
    const isChecked = document.getElementById(`kit-${tipo}-${codigo}`).checked;
    const qtyInput = document.getElementById(`kit-${tipo}-qty-${codigo}`);
    if (qtyInput) {
        qtyInput.disabled = !isChecked;
        if (!isChecked) qtyInput.value = "1";
    }
};

window.togglePedidoQtyInput = (tipo, codigo) => {
    const isChecked = document.getElementById(`p-${tipo}-${codigo}`).checked;
    const qtyInput = document.getElementById(`p-${tipo}-qty-${codigo}`);
    if (qtyInput) {
        qtyInput.disabled = !isChecked;
        if (!isChecked) qtyInput.value = "1";
    }
};
