import os
import json
import datetime
from backend import config

class PorteiroSLA:
    """
    Agente 1: O Porteiro do SLA.
    Valida pedidos, calcula o SLA e audita a legitimidade das justificativas de urgência.
    """
    
    def __init__(self):
        self.config_status = config.status_backend()
        self.model = None
        if self.config_status["HAS_VERTEX"]:
            try:
                import vertexai
                from vertexai.generative_models import GenerativeModel
                
                # Inicializar o SDK do Vertex AI com chaves fornecidas
                vertexai.init(project=config.GCP_PROJECT, location=config.GCP_LOCATION)
                self.model = GenerativeModel(config.MODEL_NAME)
                print(f"[IA] Vertex AI conectado: {config.MODEL_NAME}")
            except Exception as e:
                print(f"[IA] Vertex AI indisponível (usando contingência local): {str(e)}")

    def calcular_prazo_minimo(self, data_inicio):
        """Retorna a data correspondente a data_inicio + 3 dias úteis (pula fins de semana)."""
        dias_adicionados = 0
        data_atual = data_inicio
        while dias_adicionados < 3:
            data_atual += datetime.timedelta(days=1)
            if data_atual.weekday() < 5:  # Segunda a Sexta
                dias_adicionados += 1
        return data_atual

    def analisar_justificativa_com_ia(self, justificativa):
        """Julga se o motivo do consultor para quebrar o SLA é aceitável."""
        if not justificativa or len(justificativa.strip()) < 8:
            return {"aceito": False, "motivo": "A justificativa é muito curta ou está em branco."}

        # Prompt de Few-Shot
        prompt = f"""
        Você é o 'Porteiro do SLA', um auditor automatizado da equipe de Logística.
        Analise a justificativa apresentada por um consultor que precisa de material urgente (menos de 3 dias de prazo).
        
        Você deve rejeitar desculpas vazias ou fúteis (ex: "porque sim", "esqueci", "sla", "urgente", "porque quero").
        Você deve aprovar justificativas profissionais (ex: "cliente reagendou ontem", "diretoria marcou reunião surpresa", "alteração de escopo pelo cliente").
        
        Justificativa analisada: "{justificativa}"
        
        Responda estritamente em formato JSON válido:
        {{ "aceito": true/false, "motivo": "sua justificativa detalhada em português" }}
        JSON:
        """
        
        if self.model:
            try:
                response = self.model.generate_content(prompt)
                text = response.text.strip()
                # Limpar marcação markdown json se houver
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                return json.loads(text)
            except Exception:
                pass # Fallback para motor heurístico abaixo

        # Contingência Heurística Local
        justificativa_lower = justificativa.lower().strip()
        motivos_rejeitados = ["porque sim", "por que sim", "preciso", "esqueci", "sla", "sei la", "sei lá", "quero", "urgente", "nada"]
        
        if len(justificativa_lower) < 10:
            return {"aceito": False, "motivo": "Rejeitado: Justificativa vaga ou curta demais."}
            
        for palavra in motivos_rejeitados:
            if palavra == justificativa_lower or justificativa_lower.startswith(palavra):
                return {"aceito": False, "motivo": "Rejeitado: Motivo fútil, evasivo ou não justificado profissionalmente."}
                
        return {"aceito": True, "motivo": "[Heurística] Aprovado: justificativa aparenta legitimidade operacional."}

    def validar_pedido_entrada(self, consultor, data_treinamento_str, kit_tipo, quantidade_alunos, justificativa=None):
        """
        Executa as validações do Agente 1.
        Retorna (status, payload_ou_erro)
        """
        hoje = datetime.date.today()
        
        if not consultor or not data_treinamento_str or not kit_tipo or not quantidade_alunos:
            return "TRIGGER_REJEICAO", "Preencha todos os campos obrigatórios do treinamento."
            
        try:
            data_treinamento = datetime.datetime.strptime(data_treinamento_str, "%Y-%m-%d").date()
            qtd_alunos = int(quantidade_alunos)
            if qtd_alunos <= 0:
                return "TRIGGER_REJEICAO", "A quantidade de alunos deve ser maior que zero."
        except ValueError:
            return "TRIGGER_REJEICAO", "Formato de data inválido (use AAAA-MM-DD) ou quantidade não numérica."

        # SLA de 3 dias úteis
        prazo_minimo = self.calcular_prazo_minimo(hoje)
        sla_violado = data_treinamento < prazo_minimo

        if sla_violado:
            if not justificativa or justificativa.strip() == "":
                return "TRIGGER_ALERTA_URGENCIA", {
                    "mensagem": f"O pedido viola o SLA de 3 dias úteis (Prazo mínimo: {prazo_minimo}). Por favor, forneça uma justificativa corporativa de urgência.",
                    "sla_violado": True
                }
                
            # Validar justificativa conversacional
            analise = self.analisar_justificativa_com_ia(justificativa)
            if not analise["aceito"]:
                return "TRIGGER_REJEICAO", f"Pedido Bloqueado pelo Agente: {analise['motivo']}"
            else:
                return "PROCEED", {
                    "sla_violado": True,
                    "justificativa_urgencia": justificativa,
                    "motivo_aprovacao": analise["motivo"]
                }
        else:
            return "PROCEED", {
                "sla_violado": False,
                "justificativa_urgencia": "N/A - SLA Cumprido"
            }
