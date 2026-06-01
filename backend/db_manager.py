import os
import json
from backend import config

class DatabaseManager:
    """
    Gerenciador de Banco de Dados JSON Unificado.
    Suporta os cadastros relacionais de:
    - Consultores (nome, cpf, codigo)
    - Treinamentos (codigo, descricao)
    - Equipamentos (codigo, descricao, peso, tamanho)
    - Insumos (codigo, descricao)
    - Kits (codigo_do_kit, descricao, lista de equipamentos, lista de insumos)
    - Estoque (codigo_item: quantidade)
    - Pedidos (consultor, tipo, data, local, equipamentos, insumos, novos_insumos_solicitados)
    - Retornos (kit_id, local, data_hora_retirada)
    """
    
    def __init__(self):
        self.filepath = config.JSON_DB_PATH
        self._inicializar_banco()
        
    def _inicializar_banco(self):
        # Se o banco não existe, cria com sementes detalhadas conforme Seção A
        if not os.path.exists(self.filepath):
            dados_iniciais = {
                "consultores": [
                    {"codigo": "C01", "nome": "Renato Cruz", "cpf": "123.456.789-00"},
                    {"codigo": "C02", "nome": "Ana Souza", "cpf": "987.654.321-99"}
                ],
                "treinamentos": [
                    {
                        "codigo": "TR-AGILE",
                        "descricao_do_treinamento": "Treinamento de Liderança Ágil",
                        "equipamentos": ["EQ-PASS", "EQ-QUAD"],
                        "insumos": ["INS-POST", "INS-CAN", "INS-CRA"]
                    },
                    {
                        "codigo": "TR-TECH",
                        "descricao_do_treinamento": "Treinamento Técnico de Engenharia",
                        "equipamentos": ["EQ-NOTE", "EQ-PROJ", "EQ-PASS"],
                        "insumos": ["INS-CAN", "INS-PAP"]
                    }
                ],
                "equipamentos": [
                    {"codigo": "EQ-NOTE", "descricao_do_equipamento": "Notebook Core i7", "peso": 2.1, "tamanho": "35x25x2 cm"},
                    {"codigo": "EQ-PROJ", "descricao_do_equipamento": "Projetor Epson HD", "peso": 4.5, "tamanho": "40x30x15 cm"},
                    {"codigo": "EQ-PASS", "descricao_do_equipamento": "Passador de Slides Laser", "peso": 0.1, "tamanho": "12x3x1 cm"},
                    {"codigo": "EQ-QUAD", "descricao_do_equipamento": "Quadro Branco Móvel", "peso": 8.0, "tamanho": "120x90 cm"},
                    {"codigo": "EQ-FILM", "descricao_do_equipamento": "Câmera de Filmadora 4K", "peso": 1.5, "tamanho": "20x10x8 cm"}
                ],
                "insumos": [
                    {"codigo": "INS-POST", "descricao_do_insumo": "Bloco Post-it Amarelo 76x76"},
                    {"codigo": "INS-CAN", "descricao_do_insumo": "Caneta de Quadro (Preta/Azul)"},
                    {"codigo": "INS-CRA", "descricao_do_insumo": "Crachá Plástico com Cordão"},
                    {"codigo": "INS-PAP", "descricao_do_insumo": "Resma de Papel A4"}
                ],
                "estoque": {
                    "EQ-NOTE": 15,
                    "EQ-PROJ": 5,
                    "EQ-PASS": 20,
                    "EQ-QUAD": 4,
                    "EQ-FILM": 3,
                    "INS-POST": 100,
                    "INS-CAN": 150,
                    "INS-CRA": 200,
                    "INS-PAP": 30
                },
                "pedidos": [],
                "retornos": []
            }
            self.salvar_tudo(dados_iniciais)
        else:
            # Migração dinâmica se o banco já existir
            db = self.obter_tudo()
            salvar = False
            
            # Garantir que todos os treinamentos possuem a lista de equipamentos e insumos
            for t in db.get("treinamentos", []):
                if "equipamentos" not in t:
                    t["equipamentos"] = []
                    t["insumos"] = []
                    
                    # Tentar achar o kit correspondente nos dados antigos para resgatar
                    kits_antigos = db.get("kits", [])
                    cod_kit_tentativa = "KIT-" + t["codigo"].split("-")[-1]
                    for k in kits_antigos:
                        if k.get("codigo_do_kit") == cod_kit_tentativa or k.get("codigo_do_kit") == t["codigo"]:
                            t["equipamentos"] = k.get("equipamentos", [])
                            t["insumos"] = k.get("insumos", [])
                            break
                    salvar = True
            
            # Remover campo de kits obsoleto para limpar o JSON se desejar
            if "kits" in db:
                del db["kits"]
                salvar = True
                
            if salvar:
                self.salvar_tudo(db)

    def obter_tudo(self):
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {
                "consultores": [], "treinamentos": [], "equipamentos": [],
                "insumos": [], "estoque": {}, "pedidos": [], "retornos": []
            }

    def salvar_tudo(self, data):
        try:
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, ensure_ascii=False)
            return True
        except Exception:
            return False

    # --- Consultores ---
    def obter_consultores(self):
        return self.obter_tudo().get("consultores", [])
        
    def salvar_consultor(self, c_dict):
        db = self.obter_tudo()
        db["consultores"].append(c_dict)
        return self.salvar_tudo(db)

    # --- Treinamentos ---
    def obter_treinamentos(self):
        return self.obter_tudo().get("treinamentos", [])
        
    def salvar_treinamento(self, t_dict):
        db = self.obter_tudo()
        # Se vier sem as listas, inicializar vazias
        if "equipamentos" not in t_dict:
            t_dict["equipamentos"] = []
        if "insumos" not in t_dict:
            t_dict["insumos"] = []
        
        # Se já existe um com o mesmo código, atualizar
        existente_idx = -1
        for idx, t in enumerate(db["treinamentos"]):
            if t["codigo"] == t_dict["codigo"]:
                existente_idx = idx
                break
                
        if existente_idx != -1:
            db["treinamentos"][existente_idx].update(t_dict)
        else:
            db["treinamentos"].append(t_dict)
            
        return self.salvar_tudo(db)

    # --- Equipamentos ---
    def obter_equipamentos(self):
        return self.obter_tudo().get("equipamentos", [])
        
    def salvar_equipamento(self, eq_dict):
        db = self.obter_tudo()
        db["equipamentos"].append(eq_dict)
        # Inicializar estoque com 0 se não estiver lá
        if eq_dict["codigo"] not in db["estoque"]:
            db["estoque"][eq_dict["codigo"]] = 0
        return self.salvar_tudo(db)

    # --- Insumos ---
    def obter_insumos(self):
        return self.obter_tudo().get("insumos", [])
        
    def salvar_insumo(self, ins_dict):
        db = self.obter_tudo()
        db["insumos"].append(ins_dict)
        # Inicializar estoque com 0 se não estiver lá
        if ins_dict["codigo"] not in db["estoque"]:
            db["estoque"][ins_dict["codigo"]] = 0
        return self.salvar_tudo(db)

    # --- Kits (Depreciado/Mantido por retrocompatibilidade adaptativa) ---
    def obter_kits(self):
        # Mapeia treinamentos como kits para compatibilidade com o front antigo
        kits_compat = []
        for t in self.obter_treinamentos():
            kits_compat.append({
                "codigo_do_kit": t["codigo"],
                "descricao_do_kit": t["descricao_do_treinamento"],
                "equipamentos": t.get("equipamentos", []),
                "insumos": t.get("insumos", [])
            })
        return kits_compat
        
    def salvar_kit(self, kit_dict):
        # Mapeia kit_dict de volta para o treinamento
        t_dict = {
            "codigo": kit_dict["codigo_do_kit"],
            "descricao_do_treinamento": kit_dict["descricao_do_kit"],
            "equipamentos": kit_dict.get("equipamentos", []),
            "insumos": kit_dict.get("insumos", [])
        }
        return self.salvar_treinamento(t_dict)

    # --- Estoque ---
    def obter_estoque(self):
        return self.obter_tudo().get("estoque", {})
        
    def atualizar_saldo_estoque(self, codigo_item, quantidade):
        db = self.obter_tudo()
        db["estoque"][codigo_item] = int(quantidade)
        return self.salvar_tudo(db)

    # --- Pedidos ---
    def obter_pedidos(self):
        return self.obter_tudo().get("pedidos", [])

    def obter_pedido_por_id(self, id_pedido):
        for p in self.obter_pedidos():
            if p.get("id_pedido") == id_pedido:
                return p
        return None

    def salvar_novo_pedido(self, pedido_dict):
        db = self.obter_tudo()
        db["pedidos"].append(pedido_dict)
        return self.salvar_tudo(db)

    def atualizar_pedido(self, id_pedido, campos_update):
        db = self.obter_tudo()
        atualizado = False
        for p in db["pedidos"]:
            if p.get("id_pedido") == id_pedido:
                p.update(campos_update)
                atualizado = True
                break
        if atualizado:
            self.salvar_tudo(db)
        return atualizado

    # --- Retornos (Logística Reversa) ---
    def obter_retornos(self):
        return self.obter_tudo().get("retornos", [])
        
    def salvar_retorno(self, retorno_dict):
        db = self.obter_tudo()
        db["retornos"].append(retorno_dict)
        return self.salvar_tudo(db)
