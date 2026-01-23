"""
API Routes para Gestão de Serviços do Sistema
Permite ao Admin reiniciar serviços como WhatsApp, limpar caches, etc.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, Optional
from datetime import datetime, timezone
import subprocess
import logging
import os
import shutil

from utils.database import get_database
from utils.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/servicos", tags=["admin-servicos"])

db = get_database()


def run_command(command: list, timeout: int = 30) -> Dict[str, Any]:
    """Executa um comando do sistema e retorna o resultado"""
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "return_code": result.returncode
        }
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "stdout": "",
            "stderr": "Comando excedeu o tempo limite",
            "return_code": -1
        }
    except Exception as e:
        return {
            "success": False,
            "stdout": "",
            "stderr": str(e),
            "return_code": -1
        }


@router.get("/status")
async def obter_status_servicos(
    current_user: dict = Depends(get_current_user)
):
    """Obtém o status de todos os serviços do sistema"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem ver o status dos serviços")
    
    try:
        # Verificar se supervisor está disponível
        check_result = run_command(["which", "supervisorctl"])
        
        if not check_result["success"]:
            # Ambiente de produção sem supervisor
            return {
                "servicos": [
                    {
                        "nome": "backend",
                        "status": "RUNNING",
                        "pid": None,
                        "uptime": None,
                        "running": True
                    }
                ],
                "ambiente": "producao",
                "mensagem": "Supervisor não disponível. Em produção, os serviços são geridos pelo Kubernetes.",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        
        # Obter status do supervisor
        result = run_command(["supervisorctl", "status"])
        
        servicos = []
        if result["success"] and result["stdout"]:
            for line in result["stdout"].strip().split("\n"):
                parts = line.split()
                if len(parts) >= 2:
                    nome = parts[0]
                    status = parts[1]
                    
                    # Extrair PID e uptime se disponível
                    pid = None
                    uptime = None
                    
                    if "pid" in line:
                        try:
                            pid_part = [p for p in parts if p.startswith("pid")]
                            if pid_part:
                                pid = pid_part[0].replace("pid", "").replace(",", "")
                        except:
                            pass
                    
                    if "uptime" in line:
                        try:
                            uptime_idx = parts.index("uptime")
                            if uptime_idx + 1 < len(parts):
                                uptime = parts[uptime_idx + 1]
                        except:
                            pass
                    
                    servicos.append({
                        "nome": nome,
                        "status": status,
                        "pid": pid,
                        "uptime": uptime,
                        "running": status == "RUNNING"
                    })
        
        return {
            "servicos": servicos,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter status dos serviços: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/whatsapp/reiniciar")
async def reiniciar_whatsapp(
    current_user: dict = Depends(get_current_user)
):
    """Reinicia o serviço WhatsApp"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem reiniciar serviços")
    
    try:
        logger.info(f"🔄 Admin {current_user['email']} está a reiniciar o serviço WhatsApp")
        
        # 1. Limpar locks do Chromium antes de reiniciar
        locks_limpos = limpar_locks_whatsapp()
        
        # 2. Verificar se supervisor está disponível
        check_result = run_command(["which", "supervisorctl"])
        if not check_result["success"]:
            # Supervisor não disponível (ambiente de produção/Kubernetes)
            await db.logs_sistema.insert_one({
                "tipo": "reinicio_servico",
                "servico": "whatsapp",
                "user_id": current_user["id"],
                "user_email": current_user["email"],
                "resultado": "nao_disponivel",
                "detalhes": {"locks_limpos": locks_limpos, "ambiente": "producao"},
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            return {
                "success": False,
                "message": "Supervisor não disponível neste ambiente. Em produção, use o painel de Kubernetes para reiniciar os pods.",
                "locks_limpos": locks_limpos
            }
        
        # 3. Parar o serviço
        stop_result = run_command(["supervisorctl", "stop", "whatsapp"])
        
        # 4. Aguardar um momento
        import time
        time.sleep(2)
        
        # 5. Iniciar o serviço
        start_result = run_command(["supervisorctl", "start", "whatsapp"])
        
        # 6. Verificar status
        status_result = run_command(["supervisorctl", "status", "whatsapp"])
        
        # Registar log de acção
        await db.logs_sistema.insert_one({
            "tipo": "reinicio_servico",
            "servico": "whatsapp",
            "user_id": current_user["id"],
            "user_email": current_user["email"],
            "resultado": "sucesso" if start_result["success"] else "erro",
            "detalhes": {
                "locks_limpos": locks_limpos,
                "stop_result": stop_result,
                "start_result": start_result
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        if start_result["success"]:
            return {
                "success": True,
                "message": "Serviço WhatsApp reiniciado com sucesso",
                "locks_limpos": locks_limpos,
                "status": status_result.get("stdout", "").strip()
            }
        else:
            return {
                "success": False,
                "message": "Erro ao reiniciar o serviço WhatsApp",
                "error": start_result.get("stderr", ""),
                "locks_limpos": locks_limpos
            }
            
    except Exception as e:
        logger.error(f"Erro ao reiniciar WhatsApp: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/whatsapp/limpar-sessao")
async def limpar_sessao_whatsapp(
    parceiro_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Limpa a sessão WhatsApp de um parceiro específico ou todas as sessões"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem limpar sessões")
    
    try:
        logger.info(f"🧹 Admin {current_user['email']} está a limpar sessões WhatsApp")
        
        sessoes_limpas = []
        whatsapp_auth_dir = "/app/backend/whatsapp_service/.wwebjs_auth"
        
        if os.path.exists(whatsapp_auth_dir):
            if parceiro_id:
                # Limpar sessão específica
                session_dir = os.path.join(whatsapp_auth_dir, f"session-{parceiro_id}")
                if os.path.exists(session_dir):
                    shutil.rmtree(session_dir)
                    sessoes_limpas.append(parceiro_id)
            else:
                # Limpar todas as sessões
                for item in os.listdir(whatsapp_auth_dir):
                    if item.startswith("session"):
                        item_path = os.path.join(whatsapp_auth_dir, item)
                        if os.path.isdir(item_path):
                            shutil.rmtree(item_path)
                            sessoes_limpas.append(item)
        
        # Registar log
        await db.logs_sistema.insert_one({
            "tipo": "limpeza_sessao_whatsapp",
            "parceiro_id": parceiro_id,
            "sessoes_limpas": sessoes_limpas,
            "user_id": current_user["id"],
            "user_email": current_user["email"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "message": f"Sessões limpas: {len(sessoes_limpas)}",
            "sessoes_limpas": sessoes_limpas
        }
        
    except Exception as e:
        logger.error(f"Erro ao limpar sessões: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def limpar_locks_whatsapp() -> int:
    """Limpa os ficheiros de lock do Chromium para o WhatsApp"""
    locks_removidos = 0
    
    # Diretórios onde podem existir locks
    dirs_to_check = [
        "/app/backend/whatsapp_service/.wwebjs_auth",
        "/tmp/.config/chromium"
    ]
    
    lock_files = ["SingletonLock", "SingletonCookie", "SingletonSocket"]
    
    for base_dir in dirs_to_check:
        if os.path.exists(base_dir):
            for root, dirs, files in os.walk(base_dir):
                for lock_file in lock_files:
                    lock_path = os.path.join(root, lock_file)
                    if os.path.exists(lock_path):
                        try:
                            os.remove(lock_path)
                            locks_removidos += 1
                            logger.info(f"🗑️ Lock removido: {lock_path}")
                        except Exception as e:
                            logger.error(f"Erro ao remover lock {lock_path}: {e}")
    
    # Tentar matar processos Chromium órfãos
    try:
        subprocess.run(["pkill", "-9", "chromium"], capture_output=True)
        subprocess.run(["pkill", "-9", "chrome"], capture_output=True)
    except:
        pass
    
    return locks_removidos


@router.post("/backend/reiniciar")
async def reiniciar_backend(
    current_user: dict = Depends(get_current_user)
):
    """Reinicia o serviço Backend (use com cuidado!)"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem reiniciar serviços")
    
    try:
        logger.info(f"🔄 Admin {current_user['email']} está a reiniciar o backend")
        
        # Registar log antes de reiniciar
        await db.logs_sistema.insert_one({
            "tipo": "reinicio_servico",
            "servico": "backend",
            "user_id": current_user["id"],
            "user_email": current_user["email"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Reiniciar em background (o processo atual vai morrer)
        subprocess.Popen(
            ["supervisorctl", "restart", "backend"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        return {
            "success": True,
            "message": "Backend será reiniciado em breve. Aguarde alguns segundos e recarregue a página."
        }
        
    except Exception as e:
        logger.error(f"Erro ao reiniciar backend: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/{servico}")
async def obter_logs_servico(
    servico: str,
    linhas: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Obtém os últimos logs de um serviço"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem ver logs")
    
    servicos_validos = ["whatsapp", "backend", "frontend"]
    if servico not in servicos_validos:
        raise HTTPException(status_code=400, detail=f"Serviço inválido. Válidos: {servicos_validos}")
    
    try:
        log_file = f"/var/log/supervisor/{servico}.err.log"
        
        if not os.path.exists(log_file):
            log_file = f"/var/log/supervisor/{servico}.out.log"
        
        if not os.path.exists(log_file):
            return {"logs": [], "message": "Ficheiro de log não encontrado"}
        
        result = run_command(["tail", "-n", str(linhas), log_file])
        
        logs = result["stdout"].split("\n") if result["stdout"] else []
        
        return {
            "servico": servico,
            "logs": logs,
            "total_linhas": len(logs)
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historico")
async def obter_historico_acoes(
    limite: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Obtém histórico de ações de gestão de serviços"""
    
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores")
    
    try:
        logs = await db.logs_sistema.find(
            {"tipo": {"$in": ["reinicio_servico", "limpeza_sessao_whatsapp"]}},
            {"_id": 0}
        ).sort("timestamp", -1).limit(limite).to_list(limite)
        
        return logs
        
    except Exception as e:
        logger.error(f"Erro ao obter histórico: {e}")
        raise HTTPException(status_code=500, detail=str(e))
