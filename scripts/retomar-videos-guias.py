"""Retoma os artefatos EN do item 23, respeitando o prazo de quota do Google.

Não altera a aplicação nem publica: a habilitação exige revisão, testes e CI.
Uso: python3 -u scripts/retomar-videos-guias.py --not-before 2026-10-14T00:01:00Z
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
PROJETO = RAIZ / "design-preview/videos/guia-chave"
ESTADO = PROJETO / "retomada-en-estado.json"


def registrar(etapa, **dados):
    estado = {"atualizado_em": datetime.now(timezone.utc).isoformat(),
              "etapa": etapa, **dados}
    tmp = ESTADO.with_suffix(".tmp.json")
    tmp.write_text(json.dumps(estado, ensure_ascii=False, indent=2))
    tmp.replace(ESTADO)
    print(json.dumps(estado, ensure_ascii=False), flush=True)


def esperar(segundos):
    alvo = time.time() + segundos
    while time.time() < alvo:
        time.sleep(min(60, alvo - time.time()))


def executar():
    parser = argparse.ArgumentParser()
    parser.add_argument("--not-before", required=True)
    args = parser.parse_args()
    alvo = datetime.fromisoformat(args.not_before.replace("Z", "+00:00"))
    if alvo.tzinfo is None:
        parser.error("--not-before precisa de fuso horário")
    registrar("aguardando_quota", proxima_tentativa=alvo.isoformat())
    esperar(max(0, alvo.timestamp() - time.time()))
    os.environ.update(TTS_VOICE="Charon", ZENO_STYLE="", TTS_LANGCODE="en-US")
    sys.path.insert(0, str(RAIZ / "design-preview/videos/atenza-lancamento/localizacao"))
    import tts_local
    from importlib.util import module_from_spec, spec_from_file_location
    spec = spec_from_file_location("medidor", RAIZ / "scripts/medir-videos-guias.py")
    medidor = module_from_spec(spec)
    spec.loader.exec_module(medidor)
    cenas = json.loads((PROJETO / "cenas-en.json").read_text())
    for provedor, guia in cenas.items():
        for numero, cena in enumerate(guia["cenas"], 1):
            out = PROJETO / "voz-en" / provedor / f"{numero:02d}.wav"
            if (medidor.duracao(out) or 0) > 0:
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            while True:
                registrar("gerando_audio", provedor=provedor, fala=numero)
                try:
                    tts_local.speak(cena["fala"], out)
                    if not (medidor.duracao(out) or 0) > 0:
                        raise RuntimeError("Áudio gerado inválido")
                    registrar("audio_salvo", provedor=provedor, fala=numero)
                    break
                except urllib.error.HTTPError as erro:
                    if erro.code != 429:
                        raise RuntimeError(f"TTS HTTP {erro.code}") from None
                    try:
                        detalhes = json.loads(erro.read()).get("error", {}).get("details", [])
                        prazos = [float(d["retryDelay"].removesuffix("s"))
                                  for d in detalhes if "retryDelay" in d]
                    except (ValueError, KeyError):
                        prazos = []
                    pausa = max(300, max(prazos, default=300) + 60)
                    registrar("aguardando_quota", provedor=provedor, fala=numero,
                              proxima_tentativa=datetime.fromtimestamp(
                                  time.time() + pausa, timezone.utc).isoformat())
                    esperar(pausa)
            esperar(15)
    registrar("transcrevendo")
    subprocess.run([sys.executable, "-u", "processar.py", "en"], cwd=PROJETO, check=True)
    medida = medidor.medir()["idiomas"]["en"]
    if any(not f["audio_valido"] or not f["transcrito"] for f in medida["falas"]):
        raise RuntimeError("Áudio ou transcrição ausente; render não iniciado")
    for provedor in cenas:
        registrar("renderizando", provedor=provedor)
        subprocess.run([sys.executable, "-u", "montar.py", "--idioma", "en", provedor],
                       cwd=PROJETO, check=True)
    medida = medidor.medir()["idiomas"]["en"]
    if any(not v["render_valido"] or not v["poster"] for v in medida["videos"]):
        raise RuntimeError("Vídeo ou pôster inválido; cópia não iniciada")
    for provedor in cenas:
        for extensao in ("mp4", "webp"):
            nome = f"chave-{provedor}-en.{extensao}"
            shutil.copy2(PROJETO / "renders" / nome, RAIZ / "public/media/atenza" / nome)
    registrar("aguardando_revisao_e_publicacao", progresso=medidor.medir())


if __name__ == "__main__":
    import fcntl
    with (PROJETO / "retomada-en.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            sys.exit("Já existe uma retomada ativa")
        try:
            executar()
        except Exception as erro:
            registrar("falhou", tipo=type(erro).__name__)
            raise SystemExit(1) from None
