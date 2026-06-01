import datetime

class GuardiaoReversa:
    """
    Agente 3: O Guardião da Reversa.
    Gerencia alertas de retorno no D+1 e o fluxo conversacional de triagem física.
    """
    
    def __init__(self):
        pass

    def verificar_eventos_concluidos(self, pedidos_ativos, data_simulada=None):
        """Identifica pedidos de treinamentos concluídos ontem para iniciar a reversa."""
        hoje = data_simulada if data_simulada else datetime.date.today()
        alertas = []
        
        for p in pedidos_ativos:
            try:
                dt_treino = datetime.datetime.strptime(p['data_treinamento'], "%Y-%m-%d").date()
            except Exception:
                continue
                
            dia_seguinte = dt_treino + datetime.timedelta(days=1)
            
            if hoje >= dia_seguinte and p.get('status_logistica') in ["ENVIADO", "EM_TREINAMENTO"]:
                alertas.append({
                    "id_pedido": p["id_pedido"],
                    "consultor_nome": p["consultor_nome"],
                    "status_original": p["status_logistica"],
                    "mensagem": f"Olá {p['consultor_nome']}! O treinamento que você realizou em {p['data_treinamento']} foi finalizado. "
                                f"Gere agora a etiqueta de postagem de retorno dos materiais corporativos. "
                                f"Informe o código de devolução para controle logístico."
                })
        return alertas

    def executar_triagem_retorno(self, pedido, atrasado, responsabilidade_atraso, avariado, itens_faltantes, custo_estimado=0.0):
        """Calcula o status final, condição e depreciação financeira baseada na triagem."""
        status_retorno = "NO_PRAZO"
        if atrasado:
            if responsabilidade_atraso == "Consultor":
                status_retorno = "ATRASO_CONSULTOR"
            elif responsabilidade_atraso == "Cliente":
                status_retorno = "ATRASO_CLIENTE"
            else:
                status_retorno = "ATRASO_LOGISTICA"
                
        condicao = "100_INTEGRO"
        if avariado:
            condicao = "AVARIADO"
        elif itens_faltantes:
            condicao = "ITENS_FALTANTES"
            
        custo = float(custo_estimado) if custo_estimado else 0.0
        if condicao == "100_INTEGRO":
            custo = 0.0
            
        return {
            "status_logistica": "CONCLUIDO",
            "reversa_status_retorno": status_retorno,
            "reversa_condicao_material": condicao,
            "reversa_custo_perda": custo
        }
