# Product Requirement & Technical Design Document (PRD/TDD)
## Projeto: Agentic Reverse Logistics & Operations Pilot (POC)
**Autor:** Consultoria de Operações e Engenharia de Dados  
**Framework Alvo:** Google Antigravity Ecosystem (Python / Cloud Functions / Event-Driven)  
**Status:** Proposta / Sandbox  
**Data:** Junho de 2026  

---

## 1. Visão Geral do Produto (Product Vision)

### 1.1 O Problema (Problem Statement)
Uma operação de logística interna de materiais de escritório e kits de treinamento que sofre com:
* **Ruído no Input (Entrada):** Consultores internos ignorando o SLA de 3 dias úteis, enviando pedidos incompletos e complementando dados via WhatsApp de última hora.
* **Falha de Processo (Execution Gap):** Um time operacional novo que, sob a pressão das urgências (picos nas quintas, sextas e segundas), comete erros básicos na separação por falta de conformidade e auditoria de passos.
* **Apagão de Visibilidade (SRE/Observabilidade):** Total desconhecimento do fluxo de retorno (Logística Reversa). Não há rastreabilidade sobre "como" o material chega, "quem" atrasou ou "o que" foi perdido/danificado.

### 1.2 A Solução Baseada em Agentes (The Agentic Approach)
Substituir a necessidade de interfaces complexas de ERP/WMS/Jira por **Agentes de Ação (AI Agents)** baseados em LLM de tamanho otimizado (SLMs), operando como intermediários conversacionais e auditores de processo. O usuário (consultor ou estoquista) interage por linguagem natural; o Agente valida as regras de negócio e grava dados estruturados em segundo plano.

---

## 2. Arquitetura da Solução (Antigravity Architecture Blueprint)

A arquitetura segue o princípio do acoplamento frouxo (*loose coupling*) orientado a eventos, utilizando o Google Workspace como camada de armazenamento e visualização de baixo custo para a POC, garantindo atrito zero com a infraestrutura atual do cliente.

[ Usuários: Consultor / Estoque ]
                   │
         (Linguagem Natural)
                   ▼
   [ Antigravity Gateway / Interface ]
                   │
    ┌──────────────┴──────────────┐
    ▼                             ▼
[ Orchestrator Agent ] ──> [ LLM Engine (Vertex AI / SLM) ]
│
(Event Dispatched)
▼
[ Python Cloud Functions ]
│
├─> Write/Read ──> [ Google Sheets / BigQuery (DB Oculto) ]
└─> Push Metric ─> [ Looker Studio Dashboard ]

### 2.1 Componentes Tecnológicos
* **Orchestration Engine:** Script Python utilizando o conceito Antigravity para despacho de eventos assíncronos e controle de estado do inventário.
* **Intelligence Layer:** Vertex AI (Gemini 1.5 Flash para baixa latência e custo zero/baixo) atuando com *Function Calling* para validação de regras.
* **State & Storage Layer:** Google Sheets API (atuando como o banco de dados relacional e histórico para a POC).
* **Observability Layer:** Google Looker Studio extraindo dados diretamente da camada de Storage.

---

## 3. Especificações Funcionais (User Stories & Agent Personas)

### 3.1 Agente 1: O Porteiro do SLA (Entrada de Pedidos)
* **Objetivo:** Eliminar o WhatsApp e garantir a completude do input antes de enviar o pedido para o estoque.
* **Gatilho:** Consultor inicia uma conversa para pedir material.
* **Fluxo de Execução (Engine Logic):**
  1. O agente solicita a *Data do Treinamento*, *Tipo de Kit* e *Quantidade de Alunos*.
  2. O agente calcula a janela de atendimento:

```python
def validar_pedido_entrada(data_treinamento, kit_tipo, quantidade_alunos):
    hoje = datetime.date.today()
    prazo_minimo = hoje + datetime.timedelta(days=3)
    
    if data_treinamento < prazo_minimo:
        return "TRIGGER_ALERTA_URGENCIA: Pedido viola o SLA de 3 dias úteis. Solicitar justificativa obrigatória."
    if not kit_tipo or not quantidade_alunos:
        return "TRIGGER_REJEICAO: Informações insuficientes sobre os materiais."
    return "PROCEED: Payload validado."


Comportamento do Agente: Se o consultor tentar furar o SLA, o agente bloqueia o avanço e exige uma justificativa. Ele só cria o registro no banco de dados oculto quando todos os metadados estiverem preenchidos e validados.

### 3.2 Agente 2: O Auditor do Estoque (Separação e Sincronismo)
* **Objetivo:** Guiar o time novo para evitar erros bobos e equilibrar a balança da semana (aproveitar as Quartas-feiras ociosas), Otimizar o tempo ocioso da equipe operacional, mitigar picos de demanda no final de semana e garantir 100% de conformidade física na separação dos materiais antes do envio.
* **Gatilho:** Cron-job programado para toda quarta-feira às 08:00 AM, Cron-job agendado (Toda quarta-feira às 08:00 AM) para a ação preditiva e gatilhos de eventos (Event-driven) baseados em mudança de status para a auditoria de despacho.
Fluxo de Execução (Engine Logic - Balanceamento de Carga):

O agente varre a base de dados em segundo plano buscando pedidos cujo status seja A_SEPARAR com treinamentos agendados para a próxima sexta, sábado ou segunda-feira.

Caso encontre um volume concentrado, o agente executa a lógica de balanceamento preventivo de carga:

def balancear_demanda_estoque(pedidos_ativos):
    hoje = datetime.date.today()
    # Identifica a janela crítica de picos (Próximos 5 dias)
    janela_critica = [hoje + datetime.timedelta(days=i) for i in range(1, 6)]
    
    pedidos_criticos = [
        p for p in pedidos_ativos 
        if p['data_treinamento'] in janela_critica and p['status_logistica'] == "A_SEPARAR"
    ]
    
    # Se for quarta-feira (dia ocioso) e houver acúmulo de demandas futuras
    if hoje.weekday() == 2 and len(pedidos_criticos) >= 3:
        qtd_kits = len(pedidos_criticos)
        return {
            "ACTION": "TRIGGER_PRE_MONTAGEM_PREVENTIVA",
            "payload": {
                "mensagem": f"Alerta de Capacidade: Detectei {qtd_kits} treinamentos agendados para os próximos dias de pico. Aproveite a quarta-feira para pré-montar {qtd_kits} Kits Padrão de Escritório.",
                "checklist_obrigatorio": ["Canetas conferidas", "Crachás impressos", "Post-its contados", "Protocolo físico assinado"]
            }
        }
    return "PROCEED: Fluxo de separação padrão."


Ação Preditiva (Balança de Demanda): O agente varre as ordens futuras e envia um report para o time de estoque por chat: "Hoje é quarta-feira, dia de menor fluxo. Identifiquei 5 treinamentos para sexta-feira e segunda-feira. Preparem preventivamente 5 Kits Padrão de Escritório hoje. Aqui está o roteiro de pré-montagem."
O agente dispara um alerta automático no canal de chat da equipe do estoque: "Hoje é quarta-feira, dia de menor fluxo histórico. Identifiquei 5 treinamentos agendados entre sexta-feira e segunda-feira. Preparem preventivamente 5 Kits Padrão hoje. Aqui está o checklist de pré-montagem."

Trava de Transição (Gatekeeper): O operador do estoque informa ao agente quando despacha o material. O agente barra o encerramento do envio se o operador não fornecer o código de rastreio ou protocolo e confirmar visualmente os passos do checklist básico (Ex: Canetas conferidas, crachás impressos)
Quando o operador notifica o agente que concluiu a separação de um pedido, o agente assume o papel de auditor e barra o fechamento do envio caso falte conformidade operacional:
O agente exige que o operador marque as caixas de verificação do checklist básico (ex: Canetas, crachás, blocos de rascunho).
O agente exige a digitação obrigatória do código de rastreio ou número do protocolo de coleta física.
Somente após essa validação o agente atualiza o status na base de dados para ENVIADO, liberando o fluxo da esteira logística.

### 3.3 Agente 3: O Guardião da Reversa (Pós-Evento e Observabilidade)
* **Objetivo:** Mapear o "como chega", o "quando chega" e auditar perdas.
* **Gatilho:** Data_Treinamento + 1 dia (Fim do Evento).

Fluxo de Execução:

O agente aborda o consultor automaticamente via chat: "O treinamento no cliente X terminou ontem. Aqui está o link para gerar sua etiqueta de devolução. Por favor, digite o código de rastreio assim que postar."

Quando o material físico brota de volta no estoque, o estoquista avisa o agente: "Chegou o material do cliente X".

O agente executa uma triagem rápida com o operador:

Houve avaria ou perda de material de escritório?

O material chegou atrasado? De quem foi a responsabilidade? (Consultor / Cliente / Transportadora).

O agente consolida o payload e atualiza o registro com o status REVERSA_CONCLUIDA.

## 4. Esquema de Dados (Storage Schema - Google Sheets)
Para manter a POC escalável e garantir fácil migração para BigQuery no futuro, a tabela de dados (Google Sheets) terá a seguinte estrutura estruturada por colunas:

Nome da Coluna,Tipo de Dado,Descrição
id_pedido,String (UUID),Chave primária gerada pelo Agente para controle
consultor_nome,String,Identificação de quem solicitou o treinamento
data_solicitacao,Date,Timestamp do momento da abertura
data_treinamento,Date,Data real em que o treinamento vai acontecer
sla_violado,Boolean,TRUE se o pedido entrou com menos de 3 dias úteis
justificativa_urgencia,Text,Armazena o motivo da urgência exigido pelo agente
status_logistica,Enum,"A_SEPARAR, ENVIADO, EM_TREINAMENTO, REVERSA_PENDENTE, CONCLUIDO"
reversa_status_retorno,Enum,"NO_PRAZO, ATRASO_CONSULTOR, ATRASO_CLIENTE, ATRASO_LOGISTICA"
reversa_condicao_material,Enum,"100_INTEGRO, AVARIADO, ITENS_FALTANTES"
reversa_custo_perda,Float,Valor financeiro estimado de material que foi perdido/descartado

## 5. Métricas de Sucesso & Observabilidade (Looker Studio Dashboard)
A eficácia da POC e a gestão operacional serão medidas por você através de 3 KPIs centrais gerados automaticamente no painel do Looker Studio:

SLA Compliance Rate (%): Percentual de pedidos que entraram respeitando a regra de 3 dias úteis. Útil para renegociar os prazos com a diretoria de consultoria.

Reverse Logistics Friction Index: Gráfico de distribuição que aponta os reais responsáveis por atrasos no retorno dos materiais (Trazendo luz ao "como chega").

Material Depreciation Velocity: Volume financeiro acumulado de perdas de materiais de escritório segmentado por tipo de treinamento ou consultor (Auditoria financeira automática).

---

## 6. Plano de Implementação (Deployment Plan & Sandbox Execution)

Para que a POC opere dentro do ecossistema Antigravity com atrito zero, a implantação será dividida em três fases consecutivas executadas em ambiente de Sandbox.

### 6.1 Fase 1: Setup da Camada de Dados e Autenticação (Dia 1)
* **Provisionamento do Storage:** Criação da planilha no Google Sheets seguindo estritamente o esquema definido na Seção 4.
* **Credenciamento (IAM):** Configuração de uma *Service Account* no Google Cloud Console com permissões de leitura/escrita na API do Google Sheets e acesso ao Vertex AI.
* **Deploy Inicial:** Inicialização da Cloud Function `validar_pedido_entrada` para testar os gatilhos básicos de validação de SLA.

### 6.2 Fase 2: Integração da Camada de Inteligência (Dias 2 e 3)
* **Engenharia de Prompt (System Instructions):** Ingestão das personas dos Agentes (Porteiro, Auditor e Guardião) no Vertex AI utilizando o modelo Gemini 1.5 Flash.
* **Ajuste de Function Calling:** Mapeamento dos gatilhos em Python para que o LLM saiba exatamente quando invocar a escrita na planilha ou disparar alertas de urgência.
* **Testes de Borda:** Simulação de interações por linguagem natural contendo ruídos (ex: pedidos enviados sem quantidade de alunos ou com justificativas de urgência em branco).

### 6.3 Fase 3: Conexão da Observabilidade e Go-Live (Dias 4 e 5)
* **Construção do Dashboard:** Conexão do Google Looker Studio à planilha do Google Sheets.
* **Criação dos Gráficos:** Modelagem visual dos 3 KPIs centrais descritos na Seção 5.
* **Homologação:** Execução de um ciclo completo de ponta a ponta (da criação do pedido com quebra de SLA até a triagem do retorno da logística reversa) pelo time de consultoria e estoque do piloto.

---

## 7. Riscos, Mitigações e Próximos Passos (Risks & Next Steps)

### 7.1 Matriz de Risos e Mitigações

| Risco Identificado | Impacto | Mitigação Proposta |
| :--- | :--- | :--- |
| **Concorrência de Escrita:** Múltiplos agentes tentando atualizar a API do Google Sheets simultaneamente causando travamentos (*rate limits*). | Médio | Implementar uma fila de mensageria simples em Python na Cloud Function para serializar os commits de escrita. |
| **Alucinação de Regras:** O Agente aceitar uma justificativa de urgência genérica demais (ex: "pq sim") e liberar o pedido. | Alto | Refinar a *System Instruction* do Agente 1 com exemplos de *Few-Shot Prompting*, delimitando o que é considerado uma justificativa aceitável. |
| **Adesão do Time de Estoque:** Os operadores ignorarem o chat com o Agente 2 e continuarem despachando os materiais manualmente. | Alto | Vincular o fechamento das ordens de envio exclusivamente via validação do Agente, gerando um reporte diário de conformidade enviado à gerência. |

### 7.2 Próximos Passos (Critérios de Saída da POC)
Se os indicadores da POC demonstrarem uma **redução de pelo menos 40% nos erros de separação** e o dashboard do Looker Studio trouxer **100% de visibilidade sobre o custo de perda da reversa**, os próximos passos estruturados serão:
1. Migrar a camada de persistência de dados do Google Sheets para tabelas nativas no **Google BigQuery**.
2. Substituir a interface de Sandbox de chat por conectores nativos corporativos (ex: Google Chat ou Slack).
3. Expandir o escopo dos agentes para incluir a roteirização automática junto às transportadoras parceiras na etapa de Logística Reversa.