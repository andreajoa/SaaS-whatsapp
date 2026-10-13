"""Mede os artefatos locais do item 23; não confunde render local com publicação.

Uso: python3 scripts/medir-videos-guias.py
"""
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
PROJETO = RAIZ / "design-preview/videos/guia-chave"


def duracao(arquivo):
    if not arquivo.is_file():
        return None
    try:
        resultado = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(arquivo)],
            capture_output=True, text=True, check=True, timeout=20,
        )
        return round(float(resultado.stdout), 3)
    except (ValueError, subprocess.SubprocessError):
        return None


def medir():
    idiomas = {}
    for idioma in ("es", "en"):
        roteiro = json.loads((PROJETO / f"cenas-{idioma}.json").read_text())
        falas, videos = [], []
        for provedor, guia in roteiro.items():
            for numero, _ in enumerate(guia["cenas"], 1):
                wav = PROJETO / f"voz-{idioma}" / provedor / f"{numero:02d}.wav"
                palavras = wav.with_suffix(".words.json")
                segundos = duracao(wav)
                transcrito = False
                if palavras.is_file():
                    try:
                        transcrito = bool(json.loads(palavras.read_text()))
                    except (ValueError, OSError):
                        pass
                falas.append({"provedor": provedor, "fala": numero,
                              "audio_valido": segundos is not None and segundos > 0,
                              "duracao": segundos, "transcrito": transcrito})
            nome = f"chave-{provedor}-{idioma}"
            segundos = duracao(PROJETO / "renders" / f"{nome}.mp4")
            poster = PROJETO / "renders" / f"{nome}.webp"
            public = RAIZ / "public/media/atenza"
            videos.append({"provedor": provedor, "duracao": segundos,
                           "render_valido": segundos is not None and segundos > 0,
                           "poster": poster.is_file() and poster.stat().st_size > 0,
                           "copiado_para_public": all(
                               (public / f"{nome}.{ext}").is_file() for ext in ("mp4", "webp"))})
        idiomas[idioma] = {
            "audios": f"{sum(f['audio_valido'] for f in falas)}/{len(falas)}",
            "transcricoes": f"{sum(f['transcrito'] for f in falas)}/{len(falas)}",
            "renders": f"{sum(v['render_valido'] and v['poster'] for v in videos)}/{len(videos)}",
            "falas": falas, "videos": videos,
        }
    return {"medido_em": datetime.now(timezone.utc).isoformat(),
            "publicacao": "Verificar separadamente no CI e no site; public/ é local.",
            "idiomas": idiomas}


if __name__ == "__main__":
    print(json.dumps(medir(), ensure_ascii=False, indent=2))
