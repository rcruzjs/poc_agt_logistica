# 🛡️ Logistics Command - ERP de Logística Reversa & Painel Preditivo

Este projeto é uma **Prova de Conceito (POC) Fullstack** focada em otimizar e gamificar o ciclo de vida de ativos físicos (equipamentos de TI e insumos corporativos) utilizados em treinamentos. A solução combina agentes autônomos inteligentes, auditoria rígida de expedição, acompanhamento preditivo de capacidade do estoque e uma interface executiva altamente estilosa com fluxos dinâmicos animados.

---

## 🚀 Principais Recursos e Diferenciais

### 1. 📊 Painel de Eventos Operacionais (Kanban & Auditoria)
*   **Kanban de Pipeline Logístico:** Gerenciamento visual reativo pelas fases de `A SEPARAR`, `ENVIADO`, `REVERSA PENDENTE` e `CONCLUÍDO`.
*   **Alocação Obrigatória de Operador:** Trava de segurança que impede o despacho de mercadorias até que um operador de estoque assuma explicitamente a separação física do kit.
*   **Auditoria Física por Checklists (Agente 2):** Bloqueio inteligente de despacho que exige códigos de rastreamento válidos e verificação de conformidade física operacional (canetas, crachás, post-its e assinaturas).
*   **Composição com Quantidades Customizadas:** Cadastro flexível que permite alterar a quantidade exata de cada item necessário por treinamento de forma reativa.

### 2. 🌊 Live Logistics Pipeline Flowchart (Dashboard Macro)
*   **Navegação Rápida:** Acesse `/dashboard.html` diretamente da sidebar ou URL para entrar em uma visualização de gestão executiva em tempo real.
*   **Tráfego de Pedidos Animado:** Um pipeline de fluxo horizontal mapeia e exibe visualmente a densidade de pedidos em cada etapa por meio de **partículas de carga com ícones que se deslocam fisicamente de esquerda a direita** ao longo de trilhos neon brilhantes!
*   **Game-Loop Automático:** As métricas do fluxo, partículas e contadores reativos atualizam-se em tempo real a cada 4 segundos, sincronizados diretamente com as ações da tela de Kanban.

### 3. 🏰 O Cofre do Estoque (Barras de Capacidade HP)
*   **Saúde do Estoque por HP:** Visualização do inventário de Equipamentos de TI (Notebooks, Projetores) e Consumíveis (Poções/Insumos) em formato de **barras de vida clássicas de videogame**.
*   **Classificação Visual de Risco:** O preenchimento das barras e as métricas calculam de forma dinâmica a saturação do depósito:
    *   🟢 **Verde (HP > 70%):** Capacidade de abastecimento confortável.
    *   🟡 **Amarelo (HP 35%-70%):** Alerta de reposição iminente.
    *   🔴 **Vermelho (HP < 35%):** Estoque crítico/esgotado (sem mana!).

### 4. 🧠 Inteligência de Suprimentos & Rastreabilidade Preditiva
*   **Balanceador Preditivo de Capacidade:** Analisa o acúmulo de treinamentos nos próximos 5 dias de pico operacionais. Se detectar 3 ou mais envios acumulados, sugere antecipar preventivamente a montagem física de Kits de expedição, aproveitando momentos de menor fluxo no estoque.
*   **Rastreabilidade Ativa (Na Rua vs Em Casa):** O Agente mapeia onde cada material físico está circulando em tempo real (qual consultor, hotel, cidade). Se o estoque local de um item estiver esgotado, ele alerta qual Logística Reversa priorizar para suprir novas demandas, mitigando novas compras desnecessárias!

---

## 🛠️ Arquitetura de Tecnologia

A aplicação é dividida em uma estrutura modular rápida, moderna e leve:
*   **Backend:** Python 3.10+ utilizando **FastAPI** para altíssima performance e rotas assíncronas documentadas automaticamente.
*   **Database:** Banco de dados JSON adaptável local (`db_logistica.json`) com versionamento dinâmico automático e integridade de sementes (mock-data inicial).
*   **Frontend:** Interface baseada em **HTML5**, lógica em **JavaScript Puro (Vanilla JS)** e design premium com **CSS3 customizado** (Glassmorphism, Dark Neon e animações por CSS Keyframes). Sem necessidade de compilação!

---

## 📥 Como Configurar e Rodar o Projeto

Siga as instruções abaixo para executar a aplicação na sua máquina:

### 1. Clonar o Repositório
```bash
git clone https://github.com/rcruzjs/poc_agt_logistica.git
cd poc_agt_logistica
```

### 2. Criar e Ativar Ambiente Virtual (Recomendado)
No Windows:
```powershell
python -m venv venv
.\venv\Scripts\activate
```

### 3. Instalar Dependências
```bash
pip install fastapi uvicorn pydantic
```

### 4. Iniciar o Servidor FastAPI
Execute o comando abaixo na pasta raiz do projeto:
```bash
python -m uvicorn backend.main:app --reload
```
*O servidor FastAPI inicializará com sucesso e recarregará a cada alteração de código física!*

### 5. Acessar as Interfaces Gráficas
Abra o seu navegador e acesse as URLs correspondentes:
*   **Painel Operacional Kanban:** 👉 [http://127.0.0.1:8000](http://127.0.0.1:8000)
*   **Dashboard Macro de Fluxo RPG:** 👉 [http://127.0.0.1:8000/dashboard.html](http://127.0.0.1:8000/dashboard.html)
*   **Documentação Interativa Swagger da API:** 👉 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

## 🧪 Suíte de Testes Automatizados (API)

A integridade operacional das rotas da API, regras de alocação de estoquistas e lógicas de cálculo de estoque preditivo é coberta por testes de integração rápidos no backend. 

Para rodar a suíte inteira, certifique-se de que as dependências de teste estejam ativas e execute no seu console:
```bash
python -m unittest backend/test_api.py
```
*Todos os testes devem passar com status `OK` em menos de 0.1 segundos!*

---

## 🛡️ Segurança de Dados e Credenciais
A integridade de chaves de acesso externas do Google Cloud (como `credentials.json`) e variáveis locais contendo parâmetros e portas sensíveis (`.env`) é protegida por regras rígidas de segurança no arquivo `.gitignore`. **Nunca envie segredos de produção ao repositório público!**

---
*Logistics Command — Desenvolvido com carinho para simplificar as operações de logística reversa e gestão de estoque preditivo.*
