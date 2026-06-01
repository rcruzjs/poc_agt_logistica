import datetime

class AuditorEstoque:
    """
    Agente 2: O Auditor do Estoque.
    1. Executa o balanceamento preditivo das demandas na quarta-feira.
    2. Trava despachos físicos sem conformidade operacional.
    3. Processo de Inteligência (Seção D): Acompanha os pedidos ativos, retornos pendentes,
       estoque físico e calcula preventivamente sugestões de compras para evitar rupturas.
    """
    
    def __init__(self):
        self.checklist_obrigatorio = [
            "Canetas conferidas",
            "Crachás impressos",
            "Post-its contados",
            "Protocolo físico assinado"
        ]

    def balancear_demanda_estoque(self, pedidos_ativos, data_simulada=None):
        """Varre pedidos ativos e sugere pré-montagem se houver acúmulo de demandas futuras."""
        hoje = data_simulada if data_simulada else datetime.date.today()
        
        # Próximos 5 dias
        janela_critica = [hoje + datetime.timedelta(days=i) for i in range(1, 6)]
        
        pedidos_criticos = []
        for p in pedidos_ativos:
            try:
                dt_treino = datetime.datetime.strptime(p['data_treinamento'], "%Y-%m-%d").date()
            except Exception:
                continue
                
            if dt_treino in janela_critica and p.get('status_logistica') == "A_SEPARAR":
                pedidos_criticos.append(p)
                
        # Removido o bloqueio restritivo de Quarta-feira para permitir simulação e operação contínua a qualquer momento
        if len(pedidos_criticos) >= 3:
            qtd_kits = len(pedidos_criticos)
            return {
                "ACTION": "TRIGGER_PRE_MONTAGEM_PREVENTIVA",
                "sucesso": True,
                "mensagem": f"Alerta do Auditor (Balança de Demanda): Identifiquei {qtd_kits} treinamentos concentrados nos próximos 5 dias de pico. Sugiro adiantar a pré-montagem física de {qtd_kits} Kits Padrão preventivamente!",
                "checklist_obrigatorio": self.checklist_obrigatorio,
                "pedidos_afetados": [p["id_pedido"] for p in pedidos_criticos]
            }
        else:
            return {
                "ACTION": "PROCEED",
                "sucesso": True,
                "mensagem": "Fluxo logístico de picos futuros sob controle. Nenhuma ação preventiva necessária no momento."
            }

    def validar_despacho_envio(self, id_pedido, checklists_confirmados, codigo_rastreio):
        """Garante conformidade do despacho (checklist e rastreamento preenchidos)."""
        if not codigo_rastreio or str(codigo_rastreio).strip() == "":
            return {
                "aceito": False,
                "motivo": "Bloqueio: Digite o código de rastreamento ou número do protocolo de postagem/coleta."
            }
            
        itens_faltantes = []
        for item in self.checklist_obrigatorio:
            if item not in checklists_confirmados:
                itens_faltantes.append(item)
                
        if itens_faltantes:
            return {
                "aceito": False,
                "motivo": f"Bloqueio: Checklist incompleto. Itens pendentes de inspeção física: {', '.join(itens_faltantes)}"
            }
            
        return {
            "aceito": True,
            "motivo": "Despacho autorizado! Checklist de conformidade física auditado e aprovado."
        }

    def calcular_planejamento_compras(self, pedidos, estoque, equipamentos, insumos):
        """
        Processo de Inteligência (Seção D):
        Calcula preventivamente a demanda total de equipamentos e insumos para os próximos
        pedidos ativos ('A_SEPARAR'), compara com o estoque físico atual e sugere
        uma lista de novas compras necessárias para evitar rupturas operacionais.
        """
        demanda = {}
        
        # Mapeamento para buscar descrições dos códigos rapidamente
        descricoes = {}
        for eq in equipamentos:
            descricoes[eq["codigo"]] = eq["descricao_do_equipamento"]
        for ins in insumos:
            descricoes[ins["codigo"]] = ins["descricao_do_insumo"]
            
        # 1. Agregar demandas de todos os pedidos ativos ('A_SEPARAR')
        pedidos_ativos = [p for p in pedidos if p.get("status_logistica") == "A_SEPARAR"]
        
        for p in pedidos_ativos:
            # Equipamentos exigidos no kit/pedido
            eq_lista = p.get("lista_de_equipamentos", [])
            for eq_cod in eq_lista:
                demanda[eq_cod] = demanda.get(eq_cod, 0) + 1
                
            # Insumos exigidos no kit/pedido
            ins_lista = p.get("lista_de_insumos", [])
            for ins_cod in ins_lista:
                demanda[ins_cod] = demanda.get(ins_cod, 0) + 1
                
            # Novos insumos extras solicitados (campo p.get("novos_insumos_solicitados") é uma lista ou dict)
            # Pode vir como string separada por vírgula no formulário, ou lista de códigos.
            # Vamos tratar se for uma lista de dicionários ou códigos
            ins_extras = p.get("novos_insumos_solicitados", [])
            if isinstance(ins_extras, str):
                # Caso venha como texto simples do usuário no form, quebrar por vírgula
                ins_extras = [x.strip() for x in ins_extras.split(",") if x.strip()]
                
            for extra_item in ins_extras:
                # O item extra pode ser código ou descrição. Vamos checar se bate com algum código de insumo
                codigo_encontrado = None
                for ins in insumos:
                    if ins["codigo"] == extra_item or ins["descricao_do_insumo"].lower() == extra_item.lower():
                        codigo_encontrado = ins["codigo"]
                        break
                
                if codigo_encontrado:
                    demanda[codigo_encontrado] = demanda.get(codigo_encontrado, 0) + 1

        # 2. Comparar com o estoque disponível e calcular déficit
        sugestoes_compras = []
        for codigo_item, total_demanda in demanda.items():
            saldo_atual = estoque.get(codigo_item, 0)
            if saldo_atual < total_demanda:
                diferenca = total_demanda - saldo_atual
                desc = descricoes.get(codigo_item, "Item Desconhecido")
                sugestoes_compras.append({
                    "codigo": codigo_item,
                    "descricao": desc,
                    "demanda_total": total_demanda,
                    "estoque_atual": saldo_atual,
                    "quantidade_a_comprar": diferenca
                })
                
        return sugestoes_compras

    def calcular_rastreabilidade_ativos(self, pedidos, estoque, equipamentos, insumos):
        """
        Calcula o balanço de ativos 'Em Casa' (estoque disponível) vs 'Na Rua' (em trânsito/evento/reversa).
        Identifica prioridades de coleta reversa se o estoque local estiver baixo para demandas futuras.
        """
        descricoes = {}
        tipos = {}
        for eq in equipamentos:
            descricoes[eq["codigo"]] = eq["descricao_do_equipamento"]
            tipos[eq["codigo"]] = "Equipamento"
        for ins in insumos:
            descricoes[ins["codigo"]] = ins["descricao_do_insumo"]
            tipos[ins["codigo"]] = "Insumo"

        # Inicializar mapeador
        rastreio = {}
        todos_itens = list(descricoes.keys())
        for cod in todos_itens:
            rastreio[cod] = {
                "codigo": cod,
                "descricao": descricoes[cod],
                "tipo": tipos[cod],
                "em_casa": estoque.get(cod, 0),
                "na_rua": 0,
                "pedidos_na_rua": [],
                "demanda_futura": 0,
                "alerta_prioridade": False,
                "mensagem_recomendacao": ""
            }

        # Varrer pedidos para consolidar dados
        for p in pedidos:
            status = p.get("status_logistica")
            eq_lista = p.get("lista_de_equipamentos", [])
            ins_lista = p.get("lista_de_insumos", [])
            
            # Tratar também insumos extras
            ins_extras = p.get("novos_insumos_solicitados", [])
            if isinstance(ins_extras, str):
                ins_extras = [x.strip() for x in ins_extras.split(",") if x.strip()]
            
            todos_itens_pedido = eq_lista + ins_lista + ins_extras
            
            if status == "A_SEPARAR":
                for item in todos_itens_pedido:
                    if item in rastreio:
                        rastreio[item]["demanda_futura"] += 1
            elif status in ["ENVIADO", "EM_TREINAMENTO", "REVERSA_PENDENTE"]:
                for item in todos_itens_pedido:
                    if item in rastreio:
                        rastreio[item]["na_rua"] += 1
                        # Adicionar referência ao pedido se ainda não listado para evitar duplicidade visual de origens
                        origem = {
                            "id_pedido": p.get("id_pedido"),
                            "consultor": p.get("consultor_nome"),
                            "local": p.get("local"),
                            "status": status,
                            "data_treinamento": p.get("data_treinamento")
                        }
                        if origem not in rastreio[item]["pedidos_na_rua"]:
                            rastreio[item]["pedidos_na_rua"].append(origem)

        # Aferir alertas e recomendações de prioridade
        lista_final = []
        for cod, info in rastreio.items():
            if info["em_casa"] < info["demanda_futura"] and info["na_rua"] > 0:
                info["alerta_prioridade"] = True
                
                # Achar a origem mais próxima na rua para sugerir
                origem_sugerida = info["pedidos_na_rua"][0] if info["pedidos_na_rua"] else None
                if origem_sugerida:
                    info["mensagem_recomendacao"] = f"Estoque insuficiente local ({info['em_casa']} un) para demandas futuras ({info['demanda_futura']} un). Priorizar retorno reversa de {origem_sugerida['local']} (Pedido #{origem_sugerida['id_pedido']} com {origem_sugerida['consultor']})!"
            
            lista_final.append(info)

        return lista_final
