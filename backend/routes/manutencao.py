"""GPS/Odometer Import and Maintenance Alert Routes"""

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form
from typing import Optional, Dict, List
from datetime import datetime, timezone, timedelta
import uuid
import logging
import csv
import io
import re

from models.user import UserRole
from utils.auth import get_current_user
from utils.database import get_database

router = APIRouter()
db = get_database()
logger = logging.getLogger(__name__)


# ==================== IMPORTAÇÃO GPS / ODÓMETRO ====================

@router.post("/import/gps-odometro")
async def importar_gps_odometro(
    file: UploadFile = File(...),
    current_user: Dict = Depends(get_current_user)
):
    """
    Importar ficheiro CSV/Excel com dados de GPS/Odómetro (Verizon Fleet ou similar).
    Detecta automaticamente as colunas relevantes.
    Actualiza km_atual dos veículos e verifica necessidade de revisão.
    """
    if current_user["role"] not in [UserRole.ADMIN, UserRole.GESTAO, UserRole.PARCEIRO]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    
    try:
        # Ler conteúdo do ficheiro
        contents = await file.read()
        
        # Detectar encoding
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'cp1252']:
            try:
                decoded = contents.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise HTTPException(status_code=400, detail="Não foi possível decodificar o ficheiro")
        
        # Detectar delimiter
        sample = decoded[:2000]
        delimiter = ';' if sample.count(';') > sample.count(',') else ','
        logger.info(f"GPS Import - Delimiter detectado: '{delimiter}'")
        
        csv_reader = csv.DictReader(io.StringIO(decoded), delimiter=delimiter)
        headers = csv_reader.fieldnames or []
        
        logger.info(f"GPS Import - Colunas encontradas: {headers}")
        
        # Mapear colunas automaticamente
        column_mapping = detect_gps_columns(headers)
        logger.info(f"GPS Import - Mapeamento: {column_mapping}")
        
        if not column_mapping.get('matricula') and not column_mapping.get('veiculo'):
            raise HTTPException(
                status_code=400, 
                detail=f"Não foi possível identificar coluna de matrícula/veículo. Colunas: {headers}"
            )
        
        if not column_mapping.get('km') and not column_mapping.get('odometro'):
            raise HTTPException(
                status_code=400, 
                detail=f"Não foi possível identificar coluna de km/odómetro. Colunas: {headers}"
            )
        
        # Processar linhas
        resultados = {
            "veiculos_atualizados": 0,
            "veiculos_nao_encontrados": [],
            "alertas_criados": 0,
            "erros": []
        }
        
        veiculos_processados = set()
        
        for row_num, row in enumerate(csv_reader, start=2):
            try:
                # Obter matrícula
                matricula = None
                for col in ['matricula', 'veiculo', 'license_plate', 'registration']:
                    if column_mapping.get(col):
                        matricula = row.get(column_mapping[col], '').strip().upper()
                        if matricula:
                            break
                
                if not matricula:
                    continue
                
                # Normalizar matrícula (remover espaços, hífens)
                matricula_normalizada = re.sub(r'[\s\-]', '-', matricula)
                
                # Obter km/odómetro
                km_valor = None
                for col in ['km', 'odometro', 'mileage', 'odometer']:
                    if column_mapping.get(col):
                        km_str = row.get(column_mapping[col], '').strip()
                        if km_str:
                            # Limpar valor (remover unidades, espaços, converter vírgula)
                            km_str = re.sub(r'[^\d,.]', '', km_str)
                            km_str = km_str.replace(',', '.')
                            try:
                                km_valor = float(km_str)
                                break
                            except ValueError:
                                continue
                
                if not km_valor:
                    continue
                
                # Evitar processar o mesmo veículo mais de uma vez (manter o maior km)
                if matricula_normalizada in veiculos_processados:
                    continue
                veiculos_processados.add(matricula_normalizada)
                
                # Buscar veículo na base de dados
                veiculo = await db.vehicles.find_one({
                    "$or": [
                        {"matricula": matricula},
                        {"matricula": matricula_normalizada},
                        {"matricula": matricula.replace('-', ' ')},
                        {"matricula": {"$regex": f"^{re.escape(matricula_normalizada.replace('-', ''))}$", "$options": "i"}}
                    ]
                }, {"_id": 0})
                
                if not veiculo:
                    resultados["veiculos_nao_encontrados"].append({
                        "matricula": matricula,
                        "km": km_valor,
                        "linha": row_num
                    })
                    continue
                
                # Actualizar km do veículo
                km_anterior = veiculo.get("km_atual", 0) or 0
                
                # Só actualizar se o novo km for maior
                if km_valor > km_anterior:
                    await db.vehicles.update_one(
                        {"id": veiculo["id"]},
                        {"$set": {
                            "km_atual": km_valor,
                            "km_atualizado_em": datetime.now(timezone.utc).isoformat(),
                            "km_atualizado_por": current_user["id"],
                            "km_fonte": "GPS Verizon"
                        }}
                    )
                    
                    resultados["veiculos_atualizados"] += 1
                    logger.info(f"✅ Veículo {matricula}: {km_anterior} → {km_valor} km")
                    
                    # Verificar se precisa de alerta de revisão
                    alerta_criado = await verificar_alerta_revisao(veiculo, km_valor, current_user["id"])
                    if alerta_criado:
                        resultados["alertas_criados"] += 1
                
            except Exception as e:
                resultados["erros"].append({
                    "linha": row_num,
                    "erro": str(e)
                })
        
        # Guardar log da importação
        log_importacao = {
            "id": str(uuid.uuid4()),
            "tipo": "gps_odometro",
            "ficheiro": file.filename,
            "data": datetime.now(timezone.utc).isoformat(),
            "importado_por": current_user["id"],
            "resultados": resultados
        }
        await db.logs_importacao.insert_one(log_importacao)
        
        return {
            "success": True,
            "message": f"Importação concluída: {resultados['veiculos_atualizados']} veículos actualizados",
            **resultados
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro na importação GPS: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def detect_gps_columns(headers: List[str]) -> Dict[str, str]:
    """Detecta automaticamente as colunas relevantes do ficheiro GPS"""
    mapping = {}
    
    # Padrões para cada tipo de coluna
    patterns = {
        'matricula': [
            r'matricula', r'matrícula', r'plate', r'license', r'registration',
            r'veiculo', r'veículo', r'vehicle', r'reg\.?\s*n', r'placa'
        ],
        'km': [
            r'km', r'quilom', r'mileage', r'odometer', r'odómetro', r'odo',
            r'distance', r'distância', r'total\s*km'
        ],
        'data': [
            r'data', r'date', r'timestamp', r'hora', r'time', r'datetime'
        ],
        'motorista': [
            r'motorista', r'driver', r'condutor', r'nome'
        ]
    }
    
    for header in headers:
        header_lower = header.lower().strip()
        for col_type, col_patterns in patterns.items():
            if col_type not in mapping:
                for pattern in col_patterns:
                    if re.search(pattern, header_lower):
                        mapping[col_type] = header
                        break
    
    return mapping


async def verificar_alerta_revisao(veiculo: Dict, km_atual: float, user_id: str) -> bool:
    """Verifica se é necessário criar alerta de revisão para o veículo"""
    
    proxima_revisao_km = veiculo.get("proxima_revisao_km")
    km_aviso = veiculo.get("km_aviso_manutencao", 5000) or 5000
    
    if not proxima_revisao_km:
        return False
    
    km_para_revisao = proxima_revisao_km - km_atual
    
    # Verificar se está dentro do limite de aviso
    if km_para_revisao <= km_aviso and km_para_revisao > 0:
        # Verificar se já existe alerta activo para este veículo
        alerta_existente = await db.alertas.find_one({
            "veiculo_id": veiculo["id"],
            "tipo": "revisao_proxima",
            "status": {"$in": ["pendente", "ativo"]}
        })
        
        if not alerta_existente:
            # Criar alerta
            alerta = {
                "id": str(uuid.uuid4()),
                "tipo": "revisao_proxima",
                "veiculo_id": veiculo["id"],
                "matricula": veiculo.get("matricula"),
                "titulo": f"Revisão próxima: {veiculo.get('matricula')}",
                "mensagem": f"O veículo {veiculo.get('marca')} {veiculo.get('modelo')} ({veiculo.get('matricula')}) está a {km_para_revisao:.0f} km da próxima revisão.",
                "km_atual": km_atual,
                "km_revisao": proxima_revisao_km,
                "km_restantes": km_para_revisao,
                "prioridade": "alta" if km_para_revisao <= 1000 else "media",
                "status": "pendente",
                "criado_em": datetime.now(timezone.utc).isoformat(),
                "criado_por": user_id
            }
            await db.alertas.insert_one(alerta)
            
            # Criar notificação para parceiro/gestor
            await criar_notificacao_revisao(veiculo, km_atual, km_para_revisao)
            
            logger.info(f"⚠️ Alerta de revisão criado: {veiculo.get('matricula')} - {km_para_revisao:.0f} km restantes")
            return True
    
    # Verificar se já passou do km de revisão
    elif km_para_revisao <= 0:
        # Verificar se já existe alerta de revisão atrasada
        alerta_existente = await db.alertas.find_one({
            "veiculo_id": veiculo["id"],
            "tipo": "revisao_atrasada",
            "status": {"$in": ["pendente", "ativo"]}
        })
        
        if not alerta_existente:
            alerta = {
                "id": str(uuid.uuid4()),
                "tipo": "revisao_atrasada",
                "veiculo_id": veiculo["id"],
                "matricula": veiculo.get("matricula"),
                "titulo": f"⚠️ Revisão ATRASADA: {veiculo.get('matricula')}",
                "mensagem": f"O veículo {veiculo.get('marca')} {veiculo.get('modelo')} ({veiculo.get('matricula')}) já ultrapassou {abs(km_para_revisao):.0f} km do limite de revisão!",
                "km_atual": km_atual,
                "km_revisao": proxima_revisao_km,
                "km_excedidos": abs(km_para_revisao),
                "prioridade": "critica",
                "status": "pendente",
                "criado_em": datetime.now(timezone.utc).isoformat(),
                "criado_por": user_id
            }
            await db.alertas.insert_one(alerta)
            
            await criar_notificacao_revisao(veiculo, km_atual, km_para_revisao, atrasada=True)
            
            logger.info(f"🚨 Alerta de revisão ATRASADA: {veiculo.get('matricula')} - {abs(km_para_revisao):.0f} km excedidos")
            return True
    
    return False


async def criar_notificacao_revisao(veiculo: Dict, km_atual: float, km_para_revisao: float, atrasada: bool = False):
    """Cria notificações para parceiro e gestores sobre revisão"""
    
    destinatarios = []
    
    # Adicionar parceiro do veículo
    if veiculo.get("parceiro_id"):
        destinatarios.append(veiculo["parceiro_id"])
    
    # Adicionar gestores
    gestores = await db.users.find({"role": {"$in": ["admin", "gestao"]}}, {"_id": 0, "id": 1}).to_list(100)
    for g in gestores:
        if g["id"] not in destinatarios:
            destinatarios.append(g["id"])
    
    # Criar notificação para cada destinatário
    for dest_id in destinatarios:
        if atrasada:
            titulo = f"🚨 Revisão ATRASADA: {veiculo.get('matricula')}"
            mensagem = f"O veículo {veiculo.get('matricula')} já ultrapassou {abs(km_para_revisao):.0f} km do limite de revisão. Agende a revisão urgentemente!"
        else:
            titulo = f"⚠️ Revisão próxima: {veiculo.get('matricula')}"
            mensagem = f"O veículo {veiculo.get('matricula')} está a {km_para_revisao:.0f} km da próxima revisão. Considere agendar a revisão."
        
        notificacao = {
            "id": str(uuid.uuid4()),
            "user_id": dest_id,
            "tipo": "revisao_atrasada" if atrasada else "revisao_proxima",
            "titulo": titulo,
            "mensagem": mensagem,
            "link": f"/veiculos/{veiculo['id']}",
            "lida": False,
            "criada_em": datetime.now(timezone.utc).isoformat(),
            "veiculo_id": veiculo["id"]
        }
        await db.notificacoes.insert_one(notificacao)


# ==================== ALERTAS DE REVISÃO ====================

@router.get("/alertas/revisao")
async def listar_alertas_revisao(
    status: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Lista alertas de revisão pendentes"""
    
    query = {"tipo": {"$in": ["revisao_proxima", "revisao_atrasada"]}}
    
    if status:
        query["status"] = status
    
    # Parceiro só vê alertas dos seus veículos
    if current_user["role"] == UserRole.PARCEIRO:
        veiculos_parceiro = await db.vehicles.find(
            {"parceiro_id": current_user["id"]},
            {"_id": 0, "id": 1}
        ).to_list(1000)
        veiculo_ids = [v["id"] for v in veiculos_parceiro]
        query["veiculo_id"] = {"$in": veiculo_ids}
    
    alertas = await db.alertas.find(query, {"_id": 0}).sort("criado_em", -1).to_list(100)
    
    return alertas


@router.put("/alertas/{alerta_id}/resolver")
async def resolver_alerta(
    alerta_id: str,
    nova_revisao_km: Optional[float] = None,
    current_user: Dict = Depends(get_current_user)
):
    """Marca um alerta como resolvido e opcionalmente actualiza o próximo km de revisão"""
    
    alerta = await db.alertas.find_one({"id": alerta_id}, {"_id": 0})
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta não encontrado")
    
    # Actualizar alerta
    await db.alertas.update_one(
        {"id": alerta_id},
        {"$set": {
            "status": "resolvido",
            "resolvido_em": datetime.now(timezone.utc).isoformat(),
            "resolvido_por": current_user["id"]
        }}
    )
    
    # Se fornecido novo km de revisão, actualizar veículo
    if nova_revisao_km and alerta.get("veiculo_id"):
        veiculo = await db.vehicles.find_one({"id": alerta["veiculo_id"]}, {"_id": 0})
        if veiculo:
            await db.vehicles.update_one(
                {"id": alerta["veiculo_id"]},
                {"$set": {
                    "ultima_revisao_km": veiculo.get("km_atual"),
                    "ultima_revisao_data": datetime.now(timezone.utc).isoformat(),
                    "proxima_revisao_km": nova_revisao_km
                }}
            )
    
    return {"message": "Alerta resolvido com sucesso"}


# ==================== DASHBOARD DE MANUTENÇÃO ====================

@router.get("/dashboard/manutencao")
async def dashboard_manutencao(
    current_user: Dict = Depends(get_current_user)
):
    """Dashboard com resumo de manutenção da frota"""
    
    # Query base
    query = {}
    if current_user["role"] == UserRole.PARCEIRO:
        query["parceiro_id"] = current_user["id"]
    
    # Buscar todos os veículos
    veiculos = await db.vehicles.find(query, {"_id": 0}).to_list(1000)
    
    # Calcular métricas
    total_veiculos = len(veiculos)
    revisao_em_dia = 0
    revisao_proxima = 0
    revisao_atrasada = 0
    sem_dados_revisao = 0
    
    veiculos_alerta = []
    
    for v in veiculos:
        km_atual = v.get("km_atual", 0) or 0
        proxima_revisao = v.get("proxima_revisao_km")
        km_aviso = v.get("km_aviso_manutencao", 5000) or 5000
        
        if not proxima_revisao:
            sem_dados_revisao += 1
            continue
        
        km_restantes = proxima_revisao - km_atual
        
        if km_restantes <= 0:
            revisao_atrasada += 1
            veiculos_alerta.append({
                "id": v["id"],
                "matricula": v.get("matricula"),
                "marca": v.get("marca"),
                "modelo": v.get("modelo"),
                "km_atual": km_atual,
                "proxima_revisao_km": proxima_revisao,
                "km_restantes": km_restantes,
                "status": "atrasada",
                "prioridade": "critica"
            })
        elif km_restantes <= km_aviso:
            revisao_proxima += 1
            veiculos_alerta.append({
                "id": v["id"],
                "matricula": v.get("matricula"),
                "marca": v.get("marca"),
                "modelo": v.get("modelo"),
                "km_atual": km_atual,
                "proxima_revisao_km": proxima_revisao,
                "km_restantes": km_restantes,
                "status": "proxima",
                "prioridade": "alta" if km_restantes <= 1000 else "media"
            })
        else:
            revisao_em_dia += 1
    
    # Ordenar veículos em alerta por prioridade
    prioridade_ordem = {"critica": 0, "alta": 1, "media": 2}
    veiculos_alerta.sort(key=lambda x: (prioridade_ordem.get(x["prioridade"], 3), x["km_restantes"]))
    
    return {
        "resumo": {
            "total_veiculos": total_veiculos,
            "revisao_em_dia": revisao_em_dia,
            "revisao_proxima": revisao_proxima,
            "revisao_atrasada": revisao_atrasada,
            "sem_dados_revisao": sem_dados_revisao
        },
        "veiculos_alerta": veiculos_alerta[:20],  # Top 20 mais urgentes
        "ultima_atualizacao": datetime.now(timezone.utc).isoformat()
    }
