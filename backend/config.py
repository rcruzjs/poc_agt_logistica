import os

# Diretório base do backend e do projeto
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR)

# Banco de dados local JSON unificado
JSON_DB_PATH = os.path.join(BASE_DIR, "db_logistica.json")

# Credenciais Google Cloud
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")
GCP_PROJECT = "newagent-60b83"  # Detectado do credentials.json do usuário
GCP_LOCATION = "us-central1"
MODEL_NAME = "gemini-1.5-flash"

# Status de Integração Vertex AI
HAS_VERTEX_CREDENTIALS = os.path.exists(CREDENTIALS_FILE)

def status_backend():
    ai_status = f"Vertex AI Real ({MODEL_NAME})" if HAS_VERTEX_CREDENTIALS else "Motor de Regras Conversacional Local (Simulado)"
    return {
        "DB_STATUS": f"Local JSON Unified ({JSON_DB_PATH})",
        "AI_STATUS": ai_status,
        "HAS_VERTEX": HAS_VERTEX_CREDENTIALS,
        "GCP_PROJECT": GCP_PROJECT
    }
