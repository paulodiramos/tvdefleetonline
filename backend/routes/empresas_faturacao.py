"""
Empresas de Faturação - Router separado para evitar conflitos
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Optional
from datetime import datetime, timezone
import uuid
import logging

from utils.database import get_database
from utils.auth import get_current_user
from models.user import UserRole

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/empresas-faturacao", tags=["Empresas de Faturação"])
db = get_database()


@router.get("/")
async def listar_empresas_faturacao(
    current_user: dict = Depends(get_current_user)
):
    """Listar empresas de faturação do parceiro atual ou todas (admin)"""
    if current_user["role"] == UserRole.ADMIN:
        empresas = await db.empresas_faturacao.find({}, {"_id": 0}).to_list(1000)
    elif current_user["role"] == UserRole.PARCEIRO:
        empresas = await db.empresas_faturacao.find(
            {"parceiro_id": current_user["id"]}, 
            {"_id": 0}
        ).to_list(100)
    else:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    # Adicionar info do parceiro
    for empresa in empresas:
        parceiro = await db.users.find_one({"id": empresa.get("parceiro_id")}, {"_id": 0, "name": 1, "email": 1})
        if not parceiro:
            parceiro = await db.parceiros.find_one({"id": empresa.get("parceiro_id")}, {"_id": 0, "nome_empresa": 1, "email": 1})
        empresa["parceiro_nome"] = parceiro.get("name") or parceiro.get("nome_empresa") if parceiro else "Desconhecido"
    
    return empresas


@router.post("/")
async def criar_empresa_faturacao(
    data: Dict,
    current_user: dict = Depends(get_current_user)
):
    """Criar nova empresa de faturação para o parceiro"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if not data.get("nome") or not data.get("nipc"):
        raise HTTPException(status_code=400, detail="Nome e NIPC são obrigatórios")
    
    parceiro_id = data.get("parceiro_id") if current_user["role"] == UserRole.ADMIN else current_user["id"]
    
    existente = await db.empresas_faturacao.find_one({
        "parceiro_id": parceiro_id,
        "nipc": data["nipc"]
    })
    if existente:
        raise HTTPException(status_code=400, detail="Já existe uma empresa com este NIPC")
    
    empresa = {
        "id": str(uuid.uuid4()),
        "parceiro_id": parceiro_id,
        "nome": data["nome"],
        "nipc": data["nipc"],
        "morada": data.get("morada", ""),
        "codigo_postal": data.get("codigo_postal", ""),
        "cidade": data.get("cidade", ""),
        "email": data.get("email", ""),
        "telefone": data.get("telefone", ""),
        "iban": data.get("iban", ""),
        "ativa": True,
        "principal": data.get("principal", False),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user["id"]
    }
    
    if empresa["principal"]:
        await db.empresas_faturacao.update_many(
            {"parceiro_id": parceiro_id},
            {"$set": {"principal": False}}
        )
    
    await db.empresas_faturacao.insert_one(empresa)
    logger.info(f"Empresa de faturação criada: {empresa['nome']} por {current_user['id']}")
    
    # Remove MongoDB _id before returning
    empresa.pop("_id", None)
    return {"message": "Empresa criada com sucesso", "empresa": empresa}


@router.get("/{empresa_id}")
async def obter_empresa_faturacao(
    empresa_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Obter detalhes de uma empresa de faturação"""
    empresa = await db.empresas_faturacao.find_one({"id": empresa_id}, {"_id": 0})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if current_user["role"] == UserRole.PARCEIRO:
        if empresa["parceiro_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Esta empresa não lhe pertence")
    elif current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    return empresa


@router.put("/{empresa_id}")
async def atualizar_empresa_faturacao(
    empresa_id: str,
    data: Dict,
    current_user: dict = Depends(get_current_user)
):
    """Atualizar empresa de faturação"""
    empresa = await db.empresas_faturacao.find_one({"id": empresa_id})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if current_user["role"] == UserRole.PARCEIRO:
        if empresa["parceiro_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Esta empresa não lhe pertence")
    elif current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    if data.get("principal"):
        await db.empresas_faturacao.update_many(
            {"parceiro_id": empresa["parceiro_id"], "id": {"$ne": empresa_id}},
            {"$set": {"principal": False}}
        )
    
    campos_permitidos = ["nome", "nipc", "morada", "codigo_postal", "cidade", 
                         "email", "telefone", "iban", "ativa", "principal"]
    update_data = {k: v for k, v in data.items() if k in campos_permitidos}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.empresas_faturacao.update_one({"id": empresa_id}, {"$set": update_data})
    
    return {"message": "Empresa atualizada com sucesso"}


@router.delete("/{empresa_id}")
async def eliminar_empresa_faturacao(
    empresa_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Eliminar empresa de faturação"""
    empresa = await db.empresas_faturacao.find_one({"id": empresa_id})
    if not empresa:
        raise HTTPException(status_code=404, detail="Empresa não encontrada")
    
    if current_user["role"] == UserRole.PARCEIRO:
        if empresa["parceiro_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Esta empresa não lhe pertence")
    elif current_user["role"] != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    recibos_count = await db.recibos.count_documents({"empresa_faturacao_id": empresa_id})
    if recibos_count > 0:
        raise HTTPException(status_code=400, detail=f"Existem {recibos_count} recibos associados")
    
    await db.empresas_faturacao.delete_one({"id": empresa_id})
    return {"message": "Empresa eliminada com sucesso"}


@router.get("/dashboard/totais-ano")
async def dashboard_totais_empresa(
    ano: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Dashboard com totais por empresa de faturação ao ano - Matriz Motorista x Empresa"""
    if current_user["role"] not in [UserRole.ADMIN, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Não autorizado")
    
    ano = ano or datetime.now().year
    
    # Query para filtrar por parceiro se não for admin
    parceiro_filter = {}
    if current_user["role"] == UserRole.PARCEIRO:
        parceiro_filter = {"parceiro_id": current_user["id"]}
    
    empresas = await db.empresas_faturacao.find(parceiro_filter, {"_id": 0}).to_list(100)
    
    resultado = []
    motoristas_data = {}  # Acumulador por motorista
    matriz_data = {}  # Matriz motorista -> empresa -> valor
    
    # Buscar dados_semanais (onde estão os rendimentos reais)
    dados_query = {"ano": ano}
    if current_user["role"] == UserRole.PARCEIRO:
        dados_query["parceiro_id"] = current_user["id"]
    
    dados_semanais = await db.dados_semanais.find(dados_query, {"_id": 0}).to_list(5000)
    
    # Processar dados_semanais para criar matriz
    for dado in dados_semanais:
        motorista_id = dado.get("motorista_id")
        motorista_nome = dado.get("motorista_nome", "Desconhecido")
        empresa_id = dado.get("empresa_faturacao_id")
        valor_liquido = dado.get("valor_liquido", 0) or 0
        
        if not motorista_id:
            continue
        
        # Inicializar motorista se não existir
        if motorista_id not in motoristas_data:
            motoristas_data[motorista_id] = {
                "motorista_id": motorista_id,
                "motorista_nome": motorista_nome,
                "total_valor": 0,
                "total_semanas": 0,
                "por_empresa": {}
            }
            matriz_data[motorista_id] = {}
        
        # Acumular total do motorista
        motoristas_data[motorista_id]["total_valor"] += valor_liquido
        motoristas_data[motorista_id]["total_semanas"] += 1
        
        # Se tem empresa associada, acumular por empresa
        if empresa_id:
            empresa_info = next((e for e in empresas if e["id"] == empresa_id), None)
            empresa_nome = empresa_info["nome"] if empresa_info else "Empresa Desconhecida"
            
            if empresa_id not in motoristas_data[motorista_id]["por_empresa"]:
                motoristas_data[motorista_id]["por_empresa"][empresa_id] = {
                    "empresa_id": empresa_id,
                    "empresa_nome": empresa_nome,
                    "total_valor": 0,
                    "total_semanas": 0
                }
                matriz_data[motorista_id][empresa_id] = 0
            
            motoristas_data[motorista_id]["por_empresa"][empresa_id]["total_valor"] += valor_liquido
            motoristas_data[motorista_id]["por_empresa"][empresa_id]["total_semanas"] += 1
            matriz_data[motorista_id][empresa_id] += valor_liquido
        else:
            # Sem empresa associada - criar entrada "Sem Empresa"
            sem_empresa_id = "sem_empresa"
            if sem_empresa_id not in motoristas_data[motorista_id]["por_empresa"]:
                motoristas_data[motorista_id]["por_empresa"][sem_empresa_id] = {
                    "empresa_id": sem_empresa_id,
                    "empresa_nome": "Sem Empresa",
                    "total_valor": 0,
                    "total_semanas": 0
                }
                matriz_data[motorista_id][sem_empresa_id] = 0
            
            motoristas_data[motorista_id]["por_empresa"][sem_empresa_id]["total_valor"] += valor_liquido
            motoristas_data[motorista_id]["por_empresa"][sem_empresa_id]["total_semanas"] += 1
            matriz_data[motorista_id][sem_empresa_id] += valor_liquido
    
    # Calcular totais por empresa
    for empresa in empresas:
        empresa_id = empresa["id"]
        total_empresa = sum(
            matriz_data.get(m_id, {}).get(empresa_id, 0) 
            for m_id in matriz_data
        )
        
        resultado.append({
            "empresa_id": empresa_id,
            "empresa_nome": empresa["nome"],
            "empresa_nipc": empresa.get("nipc", ""),
            "ano": ano,
            "total_valor": total_empresa,
            "total_recibos": sum(1 for m in motoristas_data.values() if empresa_id in m["por_empresa"])
        })
    
    # Adicionar "Sem Empresa" se houver dados
    total_sem_empresa = sum(
        matriz_data.get(m_id, {}).get("sem_empresa", 0) 
        for m_id in matriz_data
    )
    if total_sem_empresa > 0:
        resultado.append({
            "empresa_id": "sem_empresa",
            "empresa_nome": "Sem Empresa Associada",
            "empresa_nipc": "-",
            "ano": ano,
            "total_valor": total_sem_empresa,
            "total_recibos": sum(1 for m in motoristas_data.values() if "sem_empresa" in m["por_empresa"])
        })
    
    # Calcular total geral baseado na soma dos totais das empresas (não dos motoristas)
    # Isto evita duplicação quando um motorista tem dados em múltiplas empresas
    total_empresas = sum(e["total_valor"] for e in resultado)
    total_geral = total_empresas if total_empresas > 0 else 1
    
    # Converter motoristas para lista com percentagens
    motoristas_list = []
    for m in motoristas_data.values():
        # Percentagem do total anual deste motorista em relação ao total de todas as empresas
        m["percentagem_total"] = round((m["total_valor"] / total_geral) * 100, 1)
        
        # Calcular percentagem por empresa - cada empresa tem seu próprio total
        for emp_data in m["por_empresa"].values():
            # Encontrar o total da empresa
            empresa_id = emp_data.get("empresa_id")
            empresa_info = next((e for e in resultado if e["empresa_id"] == empresa_id), None)
            total_empresa_individual = empresa_info["total_valor"] if empresa_info and empresa_info["total_valor"] > 0 else 1
            # Percentagem relativa ao total daquela empresa específica
            emp_data["percentagem"] = round((emp_data["total_valor"] / total_empresa_individual) * 100, 1)
        
        # Converter dict para lista ordenada
        m["por_empresa"] = sorted(m["por_empresa"].values(), key=lambda x: x["total_valor"], reverse=True)
        motoristas_list.append(m)
    
    # Ordenar por total_valor descendente
    motoristas_list.sort(key=lambda x: x["total_valor"], reverse=True)
    
    # Preparar colunas de empresas (incluindo "sem empresa" se houver)
    empresas_colunas = [{"id": e["empresa_id"], "nome": e["empresa_nome"]} for e in resultado]
    
    # Preparar matriz para tabela (linhas = motoristas, colunas = empresas)
    matriz_tabela = []
    for motorista_id, emp_valores in matriz_data.items():
        motorista_info = motoristas_data.get(motorista_id, {})
        row = {
            "motorista_id": motorista_id,
            "motorista_nome": motorista_info.get("motorista_nome", "Desconhecido"),
            "total_anual": motorista_info.get("total_valor", 0),
            "percentagem_total": motorista_info.get("percentagem_total", 0),
            "valores_por_empresa": {}
        }
        for emp in empresas_colunas:
            emp_id = emp["id"]
            valor = emp_valores.get(emp_id, 0)
            # Encontrar o total da empresa para calcular percentagem correcta
            empresa_info = next((e for e in resultado if e["empresa_id"] == emp_id), None)
            total_empresa_individual = empresa_info["total_valor"] if empresa_info and empresa_info["total_valor"] > 0 else 1
            row["valores_por_empresa"][emp_id] = {
                "valor": valor,
                "percentagem": round((valor / total_empresa_individual) * 100, 1) if total_empresa_individual > 0 else 0
            }
        matriz_tabela.append(row)
    
    # Ordenar matriz por total anual
    matriz_tabela.sort(key=lambda x: x["total_anual"], reverse=True)
    
    # Calcular total de recibos (número de semanas com dados)
    total_recibos = sum(e["total_recibos"] for e in resultado)
    
    return {
        "ano": ano,
        "empresas": resultado,
        "empresas_colunas": empresas_colunas,
        "motoristas": motoristas_list,
        "matriz": matriz_tabela,
        "totais": {
            "valor": total_empresas,
            "recibos": total_recibos,
            "motoristas": len(motoristas_list),
            "empresas": len(resultado)
        }
    }
