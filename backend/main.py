import datetime
import uuid
from typing import List, Optional, Dict
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend import config
from backend.db_manager import DatabaseManager
from backend.agents.porteiro_sla import PorteiroSLA
from backend.agents.auditor_estoque import AuditorEstoque
from backend.agents.guardiao_reversa import GuardiaoReversa

app = FastAPI(
    title="POC Agentic Reverse Logistics, Stock & Procurement - API Backend",
    description="Backend de serviços da POC de logística inteligente.",
    version="2.0.0"
)

# Habilitar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializar gerenciadores e agentes
db = DatabaseManager()
porteiro = PorteiroSLA()
auditor = AuditorEstoque()
guardiao = GuardiaoReversa()

# --- MODELOS DE ENTRADA (PYDANTIC V2) ---

class ConsultorEntrada(BaseModel):
    codigo: str
    nome: str
    cpf: str

class TreinamentoEntrada(BaseModel):
    codigo: str
    descricao_do_treinamento: str
    equipamentos: Optional[List[str]] = []
    insumos: Optional[List[str]] = []

class EquipamentoEntrada(BaseModel):
    codigo: str
    descricao_do_equipamento: str
    peso: float
    tamanho: str

class InsumoEntrada(BaseModel):
    codigo: str
    descricao_do_insumo: str

class KitEntrada(BaseModel):
    codigo_do_kit: str
    descricao_do_kit: str
    equipamentos: List[str]  # Lista de códigos de equipamentos
    insumos: List[str]  # Lista de códigos de insumos

class PedidoEntrada(BaseModel):
    consultor_nome: str
    data_treinamento: str
    kit_tipo: str  # Representa o tipo/kit do treinamento
    quantidade_alunos: str
    local: str
    lista_de_equipamentos: List[str]
    lista_de_insumos: List[str]
    novos_insumos_solicitados: Optional[str] = ""
    justificativa: Optional[str] = None

class DespachoEntrada(BaseModel):
    checklists_confirmados: List[str]
    codigo_rastreio: str

class TriagemEntrada(BaseModel):
    # Retorno física (Seção C)
    local_retirada: str
    data_retirada: str
    hora_retirada: str
    # Triagem
    atrasado: bool
    responsabilidade_atraso: str
    avariado: bool
    itens_faltantes: bool
    custo_estimado: float

class EstoqueUpdate(BaseModel):
    codigo_item: str
    quantidade: int

class AssumirPedidoEntrada(BaseModel):
    operador: str

# --- ENDPOINTS OPERACIONAIS ---

@app.get("/api/status")
def get_status():
    return config.status_backend()

@app.get("/api/pedidos")
def get_pedidos():
    return db.obter_pedidos()

@app.post("/api/pedidos")
def cadastrar_pedido(p: PedidoEntrada):
    """
    Submete um novo pedido. Executa o Agente 1 (Porteiro do SLA).
    Garante o cumprimento de prazos ou valida justificativas.
    """
    status, res = porteiro.validar_pedido_entrada(
        p.consultor_nome, p.data_treinamento, p.kit_tipo, p.quantidade_alunos, p.justificativa
    )
    
    if status == "TRIGGER_REJEICAO":
        raise HTTPException(status_code=400, detail=res)
        
    if status == "TRIGGER_ALERTA_URGENCIA":
        return {
            "status": "EXIGE_JUSTIFICATIVA",
            "mensagem": res["mensagem"],
            "sla_violado": True
        }
        
    # PROCEED: Registrar o pedido com o novo modelo (Seção B)
    id_pedido = str(uuid.uuid4())[:8].upper()
    novo_pedido = {
        "id_pedido": id_pedido,
        "consultor_nome": p.consultor_nome,
        "data_solicitacao": str(datetime.date.today()),
        "data_treinamento": p.data_treinamento,
        "kit_tipo": p.kit_tipo,
        "local": p.local,
        "lista_de_equipamentos": p.lista_de_equipamentos,
        "lista_de_insumos": p.lista_de_insumos,
        "novos_insumos_solicitados": p.novos_insumos_solicitados,
        "sla_violado": res["sla_violado"],
        "justificativa_urgencia": res["justificativa_urgencia"],
        "status_logistica": "A_SEPARAR",
        "operador_separacao": "",
        "reversa_status_retorno": "",
        "reversa_condicao_material": "",
        "reversa_custo_perda": 0.0
    }
    
    # Ao criar pedido, decrementar estoque se desejar, mas para a POC mantemos
    # o cálculo de planejamento preditivo dinâmico separado.
    salvou = db.salvar_novo_pedido(novo_pedido)
    if salvou:
        return {
            "status": "CRIADO",
            "mensagem": f"Pedido {id_pedido} registrado com sucesso para separação!",
            "pedido": novo_pedido
        }
    raise HTTPException(status_code=500, detail="Erro interno ao persistir o pedido.")

@app.post("/api/pedidos/cron-quarta")
def rodar_cron_quarta(data_simulada: Optional[str] = None):
    dt = None
    if data_simulada:
        try:
            dt = datetime.datetime.strptime(data_simulada, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de data simulada inválido.")
            
    pedidos = db.obter_pedidos()
    return auditor.balancear_demanda_estoque(pedidos, dt)

@app.post("/api/pedidos/cron-reversa")
def rodar_cron_reversa(data_simulada: Optional[str] = None):
    dt = None
    if data_simulada:
        try:
            dt = datetime.datetime.strptime(data_simulada, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Formato de data simulada inválido.")
            
    pedidos = db.obter_pedidos()
    alertas = guardiao.verificar_eventos_concluidos(pedidos, dt)
    
    # Atualizar status para REVERSA_PENDENTE
    for a in alertas:
        db.atualizar_pedido(a["id_pedido"], {"status_logistica": "REVERSA_PENDENTE"})
        
    return {
        "mensagem": f"Gatilho de Reversa diária executado. {len(alertas)} pedidos cobrados.",
        "alertas_disparados": alertas
    }

@app.post("/api/pedidos/{id_pedido}/assumir")
def assumir_pedido_separacao(id_pedido: str, a: AssumirPedidoEntrada):
    pedido = db.obter_pedido_por_id(id_pedido)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
        
    if pedido.get("status_logistica") != "A_SEPARAR":
        raise HTTPException(status_code=400, detail="Apenas pedidos em status 'A_SEPARAR' podem ser assumidos para separação.")
        
    atualizou = db.atualizar_pedido(id_pedido, {"operador_separacao": a.operador})
    if atualizou:
        return {
            "status": "SUCESSO",
            "mensagem": f"Operador '{a.operador}' assumiu a separação do pedido!",
            "pedido": db.obter_pedido_por_id(id_pedido)
        }
    raise HTTPException(status_code=500, detail="Erro interno ao assumir separação.")

@app.post("/api/pedidos/{id_pedido}/despachar")
def despachar_pedido(id_pedido: str, d: DespachoEntrada):
    pedido = db.obter_pedido_por_id(id_pedido)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
        
    if pedido.get("status_logistica") != "A_SEPARAR":
        raise HTTPException(status_code=400, detail=f"O pedido não pode ser despachado no status '{pedido.get('status_logistica')}'")

    analise = auditor.validar_despacho_envio(id_pedido, d.checklists_confirmados, d.codigo_rastreio)
    if not analise["aceito"]:
        raise HTTPException(status_code=400, detail=analise["motivo"])
        
    # Decrementar estoque real ao despachar!
    estoque = db.obter_estoque()
    equipamentos_pedido = pedido.get("lista_de_equipamentos", [])
    insumos_pedido = pedido.get("lista_de_insumos", [])
    
    # Tratar também insumos extras solicitados no decremento
    ins_extras = pedido.get("novos_insumos_solicitados", "")
    extras_lista = []
    if isinstance(ins_extras, str) and ins_extras.strip():
        extras_lista = [x.strip() for x in ins_extras.split(",") if x.strip()]
        
    for eq in equipamentos_pedido:
        if eq in estoque:
            db.atualizar_saldo_estoque(eq, max(0, estoque[eq] - 1))
    for ins in insumos_pedido:
        if ins in estoque:
            db.atualizar_saldo_estoque(ins, max(0, estoque[ins] - 1))
    for ext in extras_lista:
        # Tentar achar pelo código de insumo
        if ext in estoque:
            db.atualizar_saldo_estoque(ext, max(0, estoque[ext] - 1))

    # Atualizar status do pedido
    campos_update = {
        "status_logistica": "ENVIADO",
        "reversa_status_retorno": f"Despachado (Rastreio: {d.codigo_rastreio})"
    }
    
    atualizou = db.atualizar_pedido(id_pedido, campos_update)
    if atualizou:
        return {
            "status": "DESPACHADO",
            "mensagem": "Expedição autorizada e estoque decrementado com sucesso!",
            "pedido": db.obter_pedido_por_id(id_pedido)
        }
    raise HTTPException(status_code=500, detail="Erro interno ao despachar.")

@app.post("/api/pedidos/{id_pedido}/triagem")
def triagem_devolucao(id_pedido: str, t: TriagemEntrada):
    """
    Finaliza a reversa de recebimento dos kits (Seções C & D).
    Registra local, data e hora da retirada e a triagem física de danos/atrasos.
    """
    pedido = db.obter_pedido_por_id(id_pedido)
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
        
    if pedido.get("status_logistica") != "REVERSA_PENDENTE":
        raise HTTPException(status_code=400, detail="A triagem de devolução exige status REVERSA_PENDENTE.")

    # Executar lógica consolidada do Agente 3
    campos_update = guardiao.executar_triagem_retorno(
        pedido, t.atrasado, t.responsabilidade_atraso, t.avariado, t.itens_faltantes, t.custo_estimado
    )
    
    # 1. Registrar o Log de Retorno (Seção C)
    novo_retorno = {
        "id_pedido": id_pedido,
        "kit_codigo": pedido.get("kit_tipo", "N/A"),
        "local": t.local_retirada,
        "data_hora_retirada": f"{t.data_retirada} às {t.hora_retirada}"
    }
    db.salvar_retorno(novo_retorno)
    
    # 2. Devolver itens íntegros de volta ao estoque físico!
    if not t.avariado:
        estoque = db.obter_estoque()
        for eq in pedido.get("lista_de_equipamentos", []):
            if eq in estoque:
                db.atualizar_saldo_estoque(eq, estoque[eq] + 1)
        for ins in pedido.get("lista_de_insumos", []):
            if ins in estoque:
                db.atualizar_saldo_estoque(ins, estoque[ins] + 1)

    # Atualizar o pedido para CONCLUIDO
    atualizou = db.atualizar_pedido(id_pedido, campos_update)
    if atualizou:
        return {
            "status": "CONCLUIDO",
            "mensagem": "Retorno registrado e triagem física concluída com sucesso!",
            "pedido": db.obter_pedido_por_id(id_pedido)
        }
    raise HTTPException(status_code=500, detail="Erro interno ao triar.")

# --- PROCESSO DE INTELIGÊNCIA PREDITIVA DE COMPRAS (Seção D) ---

@app.get("/api/inteligencia/compras")
def get_sugestoes_compras():
    """
    Agente de Inteligência (Seção D):
    Acompanha pedidos ativos e estoque, sugerindo compras preventivas para evitar faltas.
    """
    pedidos = db.obter_pedidos()
    estoque = db.obter_estoque()
    equipamentos = db.obter_equipamentos()
    insumos = db.obter_insumos()
    
    sugestoes = auditor.calcular_planejamento_compras(pedidos, estoque, equipamentos, insumos)
    return {
        "sugestoes_compras": sugestoes,
        "total_itens_em_falta": len(sugestoes),
        "data_auditoria": str(datetime.date.today())
    }

@app.get("/api/inteligencia/rastreabilidade")
def get_rastreabilidade_ativos():
    """
    Agente de Rastreabilidade Operacional:
    Calcula o saldo de materiais local ('Em Casa') vs alocado ('Na Rua')
    e sugere prioridades de logística reversa.
    """
    pedidos = db.obter_pedidos()
    estoque = db.obter_estoque()
    equipamentos = db.obter_equipamentos()
    insumos = db.obter_insumos()
    
    return auditor.calcular_rastreabilidade_ativos(pedidos, estoque, equipamentos, insumos)

# --- ENDPOINTS DE CADASTROS (Seção A) ---

@app.get("/api/consultores")
def get_consultores():
    return db.obter_consultores()

@app.post("/api/consultores")
def cadastrar_consultor(c: ConsultorEntrada):
    if not c.nome or not c.cpf or not c.codigo:
        raise HTTPException(status_code=400, detail="Nome, CPF e Código são obrigatórios.")
    
    # Validar se já existe
    for existing in db.obter_consultores():
        if existing["codigo"] == c.codigo or existing["cpf"] == c.cpf:
            raise HTTPException(status_code=400, detail="Consultor com este Código ou CPF já cadastrado.")
            
    novo_c = {"codigo": c.codigo, "nome": c.nome, "cpf": c.cpf}
    if db.salvar_consultor(novo_c):
        return {"status": "SUCESSO", "consultor": novo_c}
    raise HTTPException(status_code=500, detail="Erro ao salvar consultor.")

@app.get("/api/treinamentos")
def get_treinamentos():
    return db.obter_treinamentos()

@app.post("/api/treinamentos")
def cadastrar_treinamento(t: TreinamentoEntrada):
    if not t.codigo or not t.descricao_do_treinamento:
        raise HTTPException(status_code=400, detail="Código e Descrição são obrigatórios.")
        
    if t.equipamentos and len(t.equipamentos) > 5:
        raise HTTPException(status_code=400, detail="Erro: Um treinamento pode conter no máximo 5 equipamentos.")
    if t.insumos and len(t.insumos) > 3:
        raise HTTPException(status_code=400, detail="Erro: Um treinamento pode conter no máximo 3 insumos.")
        
    novo_t = {
        "codigo": t.codigo,
        "descricao_do_treinamento": t.descricao_do_treinamento,
        "equipamentos": t.equipamentos or [],
        "insumos": t.insumos or []
    }
    if db.salvar_treinamento(novo_t):
        return {"status": "SUCESSO", "treinamento": novo_t}
    raise HTTPException(status_code=500, detail="Erro ao salvar treinamento.")

@app.get("/api/equipamentos")
def get_equipamentos():
    return db.obter_equipamentos()

@app.post("/api/equipamentos")
def cadastrar_equipamento(eq: EquipamentoEntrada):
    if not eq.codigo or not eq.descricao_do_equipamento:
        raise HTTPException(status_code=400, detail="Código e Descrição são obrigatórios.")
        
    for existing in db.obter_equipamentos():
        if existing["codigo"] == eq.codigo:
            raise HTTPException(status_code=400, detail="Equipamento com este Código já cadastrado.")
            
    novo_eq = {
        "codigo": eq.codigo,
        "descricao_do_equipamento": eq.descricao_do_equipamento,
        "peso": eq.peso,
        "tamanho": eq.tamanho
    }
    if db.salvar_equipamento(novo_eq):
        return {"status": "SUCESSO", "equipamento": novo_eq}
    raise HTTPException(status_code=500, detail="Erro ao salvar equipamento.")

@app.get("/api/insumos")
def get_insumos():
    return db.obter_insumos()

@app.post("/api/insumos")
def cadastrar_insumo(ins: InsumoEntrada):
    if not ins.codigo or not ins.descricao_do_insumo:
        raise HTTPException(status_code=400, detail="Código e Descrição são obrigatórios.")
        
    for existing in db.obter_insumos():
        if existing["codigo"] == ins.codigo:
            raise HTTPException(status_code=400, detail="Insumo com este Código já cadastrado.")
            
    novo_ins = {"codigo": ins.codigo, "descricao_do_insumo": ins.descricao_do_insumo}
    if db.salvar_insumo(novo_ins):
        return {"status": "SUCESSO", "insumo": novo_ins}
    raise HTTPException(status_code=500, detail="Erro ao salvar insumo.")

@app.get("/api/kits")
def get_kits():
    return db.obter_kits()

@app.post("/api/kits")
def cadastrar_kit(k: KitEntrada):
    if not k.codigo_do_kit or not k.descricao_do_kit:
        raise HTTPException(status_code=400, detail="Código e Descrição são obrigatórios.")
        
    if len(k.equipamentos) > 5:
        raise HTTPException(status_code=400, detail="Erro: Um kit pode conter no máximo 5 equipamentos.")
    if len(k.insumos) > 3:
        raise HTTPException(status_code=400, detail="Erro: Um kit pode conter no máximo 3 insumos.")
        
    for existing in db.obter_kits():
        if existing["codigo_do_kit"] == k.codigo_do_kit:
            raise HTTPException(status_code=400, detail="Kit com este Código já cadastrado.")
            
    novo_k = {
        "codigo_do_kit": k.codigo_do_kit,
        "descricao_do_kit": k.descricao_do_kit,
        "equipamentos": k.equipamentos,
        "insumos": k.insumos
    }
    if db.salvar_kit(novo_k):
        return {"status": "SUCESSO", "kit": novo_k}
    raise HTTPException(status_code=500, detail="Erro ao salvar kit.")

@app.get("/api/estoque")
def get_estoque_completo():
    """Retorna a tabela de estoque físico mapeando códigos e quantidades."""
    estoque = db.obter_estoque()
    equipamentos = db.obter_equipamentos()
    insumos = db.obter_insumos()
    
    # Montar listagem amigável
    tabela = []
    descricoes = {e["codigo"]: e["descricao_do_equipamento"] for e in equipamentos}
    descricoes.update({i["codigo"]: i["descricao_do_insumo"] for i in insumos})
    
    tipos = {e["codigo"]: "Equipamento" for e in equipamentos}
    tipos.update({i["codigo"]: "Insumo" for i in insumos})
    
    for item_cod, qtd in estoque.items():
        tabela.append({
            "codigo": item_cod,
            "descricao": descricoes.get(item_cod, "Item Sem Cadastro"),
            "tipo": tipos.get(item_cod, "Consumível"),
            "quantidade": qtd
        })
    return tabela

@app.post("/api/estoque/repor")
def repor_estoque(e: EstoqueUpdate):
    """Repõe ou atualiza a quantidade física de um item no estoque."""
    if not e.codigo_item:
        raise HTTPException(status_code=400, detail="Código do item é obrigatório.")
        
    estoque = db.obter_estoque()
    saldo_atual = estoque.get(e.codigo_item, 0)
    novo_saldo = max(0, saldo_atual + e.quantidade)
    
    if db.atualizar_saldo_estoque(e.codigo_item, novo_saldo):
        return {"status": "SUCESSO", "codigo": e.codigo_item, "quantidade": novo_saldo}
    raise HTTPException(status_code=500, detail="Erro interno ao repor estoque.")

# --- SERVIDOR DE ARQUIVOS ESTÁTICOS ---
import os
from fastapi.staticfiles import StaticFiles

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if not os.path.exists(FRONTEND_DIR):
    os.makedirs(FRONTEND_DIR)

app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
