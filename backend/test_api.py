import unittest
import os
import sys

# Ajustar o PATH para encontrar o módulo backend corretamente
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.main import app

class TestAPIIntegration(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_api_status(self):
        """Testa se o endpoint de status está respondendo corretamente."""
        res = self.client.get("/api/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("DB_STATUS", data)
        self.assertIn("AI_STATUS", data)

    def test_02_api_cadastros_iniciais(self):
        """Testa se as sementes iniciais de treinamentos e consultores estão presentes."""
        # 1. Consultores
        res_c = self.client.get("/api/consultores")
        self.assertEqual(res_c.status_code, 200)
        self.assertGreater(len(res_c.json()), 0)
        
        # 2. Treinamentos
        res_t = self.client.get("/api/treinamentos")
        self.assertEqual(res_t.status_code, 200)
        self.assertGreater(len(res_t.json()), 0)

    def test_03_cadastrar_novo_treinamento_com_itens(self):
        """Testa o cadastro de um novo tipo de treinamento com seus equipamentos e insumos."""
        payload = {
            "codigo": "TR-CLOUD",
            "descricao_do_treinamento": "Treinamento Cloud Serverless",
            "equipamentos": ["EQ-NOTE", "EQ-PASS"],
            "insumos": ["INS-POST", "INS-CAN"]
        }
        res = self.client.post("/api/treinamentos", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "SUCESSO")
        self.assertEqual(data["treinamento"]["codigo"], "TR-CLOUD")
        self.assertIn("EQ-NOTE", data["treinamento"]["equipamentos"])

    def test_04_pedido_fluxo_porteiro_sla(self):
        """Testa a submissão de pedidos e as validações do Agente 1 (SLA e justificativas)."""
        # Caso 1: Pedido com SLA cumprido (Julho de 2026 está bem à frente de Junho de 2026)
        payload_ok = {
            "consultor_nome": "Renato Cruz",
            "data_treinamento": "2026-07-20",
            "kit_tipo": "TR-AGILE",
            "quantidade_alunos": "15",
            "local": "Av. Paulista, 1000",
            "lista_de_equipamentos": ["EQ-PASS"],
            "lista_de_insumos": ["INS-POST"],
            "novos_insumos_solicitados": ""
        }
        res_ok = self.client.post("/api/pedidos", json=payload_ok)
        self.assertEqual(res_ok.status_code, 200)
        data_ok = res_ok.json()
        self.assertEqual(data_ok["status"], "CRIADO")
        self.assertFalse(data_ok["pedido"]["sla_violado"])
        
        # Caso 2: Pedido com SLA violado (pedido para amanhã, violando os 3 dias úteis)
        import datetime
        amanha = (datetime.date.today() + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
        
        payload_ruim = {
            "consultor_nome": "Renato Cruz",
            "data_treinamento": amanha,
            "kit_tipo": "TR-AGILE",
            "quantidade_alunos": "15",
            "local": "Av. Paulista, 1000",
            "lista_de_equipamentos": ["EQ-PASS"],
            "lista_de_insumos": ["INS-POST"],
            "novos_insumos_solicitados": ""
        }
        res_ruim = self.client.post("/api/pedidos", json=payload_ruim)
        self.assertEqual(res_ruim.status_code, 200)
        data_ruim = res_ruim.json()
        self.assertEqual(data_ruim["status"], "EXIGE_JUSTIFICATIVA")

    def test_05_fluxo_expedicao_triagem(self):
        """Testa o ciclo logístico de despacho e triagem final."""
        # 1. Criar pedido aprovado direto
        payload = {
            "consultor_nome": "Carla Diaz",
            "data_treinamento": "2026-08-10",
            "kit_tipo": "TR-TECH",
            "quantidade_alunos": "10",
            "local": "Hotel Plaza",
            "lista_de_equipamentos": ["EQ-NOTE"],
            "lista_de_insumos": ["INS-CAN"],
            "novos_insumos_solicitados": ""
        }
        res = self.client.post("/api/pedidos", json=payload)
        id_pedido = res.json()["pedido"]["id_pedido"]
        
        # 2. Despachar com checklists
        payload_despacho = {
            "checklists_confirmados": [
                "Canetas conferidas",
                "Crachás impressos",
                "Post-its contados",
                "Protocolo físico assinado"
            ],
            "codigo_rastreio": "RX987654321BR"
        }
        res_desp = self.client.post(f"/api/pedidos/{id_pedido}/despachar", json=payload_despacho)
        self.assertEqual(res_desp.status_code, 200)
        self.assertEqual(res_desp.json()["status"], "DESPACHADO")

        # 3. Forçar o status para REVERSA_PENDENTE simulando o pós-evento
        res_cron = self.client.post(f"/api/pedidos/cron-reversa?data_simulada=2026-08-12")
        self.assertEqual(res_cron.status_code, 200)
        
        # 4. Triagem do retorno
        payload_triagem = {
            "local_retirada": "Hotel Plaza - Sala 4",
            "data_retirada": "2026-08-12",
            "hora_retirada": "18:00",
            "atrasado": True,
            "responsabilidade_atraso": "Consultor",
            "avariado": True,
            "itens_faltantes": False,
            "custo_estimado": 180.50
        }
        res_tria = self.client.post(f"/api/pedidos/{id_pedido}/triagem", json=payload_triagem)
        self.assertEqual(res_tria.status_code, 200)
        self.assertEqual(res_tria.json()["status"], "CONCLUIDO")
        self.assertEqual(res_tria.json()["pedido"]["reversa_status_retorno"], "ATRASO_CONSULTOR")
        self.assertEqual(res_tria.json()["pedido"]["reversa_custo_perda"], 180.50)

if __name__ == "__main__":
    unittest.main()
