"""
Serviço de Análise de Imagens com IA para Vistorias
- Deteção de danos
- OCR de matrícula
- Comparação entre vistorias
"""

import os
import base64
import logging
from typing import Optional, List, Dict
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")


async def analisar_danos_imagem(image_base64: str, contexto: str = "") -> Dict:
    """
    Analisa uma imagem para detetar danos no veículo usando GPT-4 Vision
    """
    if not EMERGENT_LLM_KEY:
        logger.warning("EMERGENT_LLM_KEY não configurada")
        return {"erro": "IA não configurada", "danos": []}
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"vistoria-analise-{id(image_base64)}",
            system_message="""Você é um especialista em inspeção de veículos. 
Analise a imagem do veículo e identifique TODOS os danos visíveis.
Para cada dano encontrado, indique:
- Tipo: risco, amolgadela, vidro_partido, falta_peca, sujidade, ferrugem, pintura_danificada
- Localização: descreva onde está no veículo
- Gravidade: leve, moderado, grave
- Descrição: breve descrição do dano

Responda APENAS em formato JSON assim:
{
  "danos_encontrados": [
    {"tipo": "...", "localizacao": "...", "gravidade": "...", "descricao": "..."}
  ],
  "estado_geral": "bom/razoavel/mau",
  "observacoes": "..."
}

Se não houver danos visíveis, retorne danos_encontrados como array vazio."""
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=image_base64)
        
        prompt = f"Analise esta imagem do veículo e identifique todos os danos visíveis."
        if contexto:
            prompt += f"\nContexto adicional: {contexto}"
        
        user_message = UserMessage(
            text=prompt,
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Tentar parsear JSON da resposta
        import json
        try:
            # Limpar resposta se necessário
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            resultado = json.loads(response_text.strip())
            return resultado
        except json.JSONDecodeError:
            return {
                "danos_encontrados": [],
                "estado_geral": "indefinido",
                "observacoes": response,
                "parse_error": True
            }
            
    except Exception as e:
        logger.error(f"Erro na análise de danos: {e}")
        return {"erro": str(e), "danos_encontrados": []}


async def ler_matricula_imagem(image_base64: str) -> Dict:
    """
    Faz OCR da matrícula do veículo usando GPT-4 Vision
    """
    if not EMERGENT_LLM_KEY:
        return {"erro": "IA não configurada", "matricula": None}
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"vistoria-ocr-{id(image_base64)}",
            system_message="""Você é um sistema de OCR especializado em matrículas de veículos portugueses.
Analise a imagem e extraia a matrícula do veículo.
Responda APENAS com o JSON:
{
  "matricula": "XX-XX-XX",
  "confianca": "alta/media/baixa",
  "formato_valido": true/false
}
Se não conseguir ler a matrícula, retorne matricula como null."""
        ).with_model("openai", "gpt-4o")
        
        image_content = ImageContent(image_base64=image_base64)
        
        user_message = UserMessage(
            text="Leia a matrícula do veículo nesta imagem.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        import json
        try:
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            resultado = json.loads(response_text.strip())
            return resultado
        except json.JSONDecodeError:
            # Tentar extrair matrícula do texto
            import re
            match = re.search(r'[A-Z0-9]{2}[-\s]?[A-Z0-9]{2}[-\s]?[A-Z0-9]{2}', response.upper())
            if match:
                return {"matricula": match.group().replace(" ", "-"), "confianca": "baixa"}
            return {"matricula": None, "confianca": "nenhuma", "resposta_raw": response}
            
    except Exception as e:
        logger.error(f"Erro no OCR de matrícula: {e}")
        return {"erro": str(e), "matricula": None}


async def comparar_vistorias(vistoria_anterior: Dict, vistoria_atual: Dict) -> Dict:
    """
    Compara duas vistorias e identifica diferenças/novos danos
    """
    if not EMERGENT_LLM_KEY:
        return {"erro": "IA não configurada"}
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"vistoria-comparacao-{id(vistoria_atual)}",
            system_message="""Você é um especialista em análise de vistorias de veículos.
Compare duas vistorias e identifique:
1. Novos danos que não existiam antes
2. Danos que pioraram
3. Danos que foram reparados
4. Diferença de quilometragem
5. Diferença de combustível

Responda em JSON:
{
  "novos_danos": [...],
  "danos_agravados": [...],
  "danos_reparados": [...],
  "km_diferenca": 0,
  "combustivel_diferenca": 0,
  "resumo": "...",
  "alertas": [...]
}"""
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(
            text=f"""Compare estas duas vistorias:

VISTORIA ANTERIOR ({vistoria_anterior.get('data', 'N/A')}):
- KM: {vistoria_anterior.get('km', 'N/A')}
- Combustível: {vistoria_anterior.get('nivel_combustivel', 'N/A')}%
- Danos: {vistoria_anterior.get('danos', [])}
- Análise IA: {vistoria_anterior.get('analise_ia', {})}

VISTORIA ATUAL ({vistoria_atual.get('data', 'N/A')}):
- KM: {vistoria_atual.get('km', 'N/A')}
- Combustível: {vistoria_atual.get('nivel_combustivel', 'N/A')}%
- Danos: {vistoria_atual.get('danos', [])}
- Análise IA: {vistoria_atual.get('analise_ia', {})}

Identifique todas as diferenças relevantes."""
        )
        
        response = await chat.send_message(user_message)
        
        import json
        try:
            response_text = response.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            return json.loads(response_text.strip())
        except json.JSONDecodeError:
            return {"resumo": response, "parse_error": True}
            
    except Exception as e:
        logger.error(f"Erro na comparação de vistorias: {e}")
        return {"erro": str(e)}


async def gerar_relatorio_vistoria(vistoria: Dict, comparacao: Optional[Dict] = None) -> str:
    """
    Gera um relatório textual da vistoria para envio por WhatsApp/Email
    """
    if not EMERGENT_LLM_KEY:
        # Gerar relatório básico sem IA
        return _gerar_relatorio_basico(vistoria, comparacao)
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"vistoria-relatorio-{vistoria.get('id', '')}",
            system_message="""Você gera relatórios de vistoria de veículos em português de Portugal.
O relatório deve ser:
- Claro e profissional
- Formatado para WhatsApp (use emojis relevantes)
- Incluir link de confirmação no final
- Máximo 1500 caracteres"""
        ).with_model("openai", "gpt-4o")
        
        dados = f"""
Tipo: {vistoria.get('tipo', 'N/A')}
Data: {vistoria.get('data', 'N/A')}
Veículo: {vistoria.get('veiculo_matricula', 'N/A')}
Motorista: {vistoria.get('motorista_nome', 'N/A')}
KM: {vistoria.get('km', 'N/A')}
Combustível: {vistoria.get('nivel_combustivel', 'N/A')}%
Danos marcados: {len(vistoria.get('danos', []))}
Observações: {vistoria.get('observacoes', 'Nenhuma')}
"""
        if comparacao:
            dados += f"\nComparação com vistoria anterior: {comparacao.get('resumo', 'N/A')}"
        
        user_message = UserMessage(
            text=f"Gera um relatório de vistoria para WhatsApp com estes dados:\n{dados}\n\nLink de confirmação: [LINK_CONFIRMACAO]"
        )
        
        response = await chat.send_message(user_message)
        return response
        
    except Exception as e:
        logger.error(f"Erro ao gerar relatório: {e}")
        return _gerar_relatorio_basico(vistoria, comparacao)


def _gerar_relatorio_basico(vistoria: Dict, comparacao: Optional[Dict] = None) -> str:
    """Gera relatório básico sem IA"""
    tipo_emoji = "📥" if vistoria.get('tipo') == 'entrada' else "📤"
    
    relatorio = f"""
{tipo_emoji} *RELATÓRIO DE VISTORIA*

📅 Data: {vistoria.get('data', 'N/A')}
🚗 Veículo: {vistoria.get('veiculo_matricula', 'N/A')}
👤 Motorista: {vistoria.get('motorista_nome', 'N/A')}

📊 *Dados do Veículo:*
• Quilometragem: {vistoria.get('km', 'N/A')} km
• Combustível: {vistoria.get('nivel_combustivel', 'N/A')}%

"""
    
    danos = vistoria.get('danos', [])
    if danos:
        relatorio += f"⚠️ *Danos Registados ({len(danos)}):*\n"
        for i, dano in enumerate(danos, 1):
            relatorio += f"  {i}. {dano.get('tipo', 'N/A')}\n"
    else:
        relatorio += "✅ *Sem danos registados*\n"
    
    if vistoria.get('observacoes'):
        relatorio += f"\n📝 *Observações:*\n{vistoria.get('observacoes')}\n"
    
    if comparacao and not comparacao.get('erro'):
        relatorio += f"\n🔄 *Comparação:*\n{comparacao.get('resumo', 'N/A')}\n"
    
    relatorio += "\n---\n🔗 Para confirmar esta vistoria, clique no link:\n[LINK_CONFIRMACAO]"
    
    return relatorio
