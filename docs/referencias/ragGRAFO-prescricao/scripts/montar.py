# -*- coding: utf-8 -*-
"""Monta o grafo, o compêndio e a ficha de prescrição. Não chama API de embedding."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from farmacos import FARMACOS
from condicoes import CONDICOES

RAIZ = Path(__file__).resolve().parents[1]
DADOS = RAIZ / "dados"
APP = RAIZ / "app"

PORTAS_SEM_IMPRESSAO = {"HOSPITAL", "EMERGENCIA", "ENCAMINHAMENTO", "CEAF"}


def embedding_condicao(c):
    rec = []
    for r in c["receitas"]:
        rec.append(r["cenario"] + " " + " ".join(r["linhas"]))
    return " ".join([
        c["nome"], " ".join(c["sinonimos"]), "CID", c["cid"],
        "Sintomas:", " ".join(c["sintomas"]),
        "Diagnóstico:", c["diagnostico"],
        "Tratamento:", c["foco"],
        "Não fazer:", " ".join(c["nao_fazer"]),
        "Alarmes:", " ".join(c["alarmes"]),
        "Receitas:", " ".join(rec),
        "Fontes:", " ".join(c["fontes"]),
    ])


def embedding_farmaco(f):
    return " ".join([
        f["nome"], f["categoria"], f.get("classe", ""),
        "AWaRe", f.get("aware", "não se aplica"),
        "Apresentações:", " ".join(f["apresentacoes"]),
        "Componente SUS:", f["componente"],
        "Ajuste:", f["ajuste"],
        "Gestação:", f["gestacao"],
        "Alerta:", f["alerta"],
        "Fonte:", f["fonte"],
    ])


def validar():
    erros = []
    avisos = []
    ids_f = [f["id"] for f in FARMACOS]
    if len(ids_f) != len(set(ids_f)):
        erros.append("id de fármaco repetido")
    ids_c = [c["id"] for c in CONDICOES]
    if len(ids_c) != len(set(ids_c)):
        erros.append("id de condição repetido")
    mapa = {f["id"]: f for f in FARMACOS}
    vistos_r = set()
    for c in CONDICOES:
        if not c["receitas"]:
            erros.append("condição sem receita ou encaminhamento: " + c["id"])
        for r in c["receitas"]:
            if r["id"] in vistos_r:
                erros.append("receita repetida: " + r["id"])
            vistos_r.add(r["id"])
            if r["imprimivel"] and r["porta"] != "APS":
                erros.append("imprimível fora da APS: " + r["id"])
            if (not r["imprimivel"]) and r["porta"] == "APS" and r["id"] not in (
                "crise.urgencia", "k.leve", "ira.parar", "sm.base", "obes.vida",
                "vitd.manut", "hp.conferir", "asma.resgate", "vertigem.manobra",
            ):
                # vitd e asma são imprimíveis; esta lista é só documentação do que pode ser APS sem botão
                pass
            if r["porta"] in PORTAS_SEM_IMPRESSAO and r["imprimivel"]:
                erros.append("porta fechada com impressão: " + r["id"])
            texto = " ".join(r["linhas"]).lower()
            if "875" in texto:
                erros.append("apresentação 875 não vista na Rename: " + r["id"])
            if "50.000" in texto and "não inventar" not in texto:
                erros.append("ataque de vitamina D sem trava: " + r["id"])
            if "haloperidol" in texto and "sem receita" not in texto:
                erros.append("neuroléptico com receita: " + r["id"])
            for fid in r["farmacos"]:
                if fid not in mapa:
                    erros.append("fármaco inexistente %s em %s" % (fid, r["id"]))
                elif r["imprimivel"] and mapa[fid]["componente"] == "conferir_painel":
                    avisos.append("imprime fármaco com apresentação a conferir: %s / %s" % (r["id"], fid))
            if "losartana" in r["farmacos"] and "enalapril" in r["farmacos"]:
                erros.append("IECA com BRA na mesma receita: " + r["id"])
            if "losartana" in r["farmacos"] and "captopril" in r["farmacos"]:
                erros.append("IECA com BRA na mesma receita: " + r["id"])
        if c["confianca"] not in ("alta", "media", "baixa"):
            erros.append("confiança inválida: " + c["id"])
    return erros, avisos


def nos_e_arestas():
    nos = []
    arestas = []
    especiais = sorted({c["especialidade"] for c in CONDICOES})
    categorias = sorted({f["categoria"] for f in FARMACOS})
    for e in especiais:
        nomes = [c["nome"] for c in CONDICOES if c["especialidade"] == e]
        nos.append({"id": "esp." + e, "tipo": "especialidade", "nome": e,
                    "embedding_text": "Especialidade " + e + ". Condições: " + "; ".join(nomes)})
    for cat in categorias:
        nomes = [f["nome"] for f in FARMACOS if f["categoria"] == cat]
        nos.append({"id": "cat." + cat, "tipo": "categoria", "nome": cat,
                    "embedding_text": "Categoria " + cat + ". Fármacos: " + "; ".join(nomes)})
    for f in FARMACOS:
        nos.append({
            "id": "far." + f["id"], "tipo": "farmaco", "nome": f["nome"],
            "categoria": f["categoria"], "classe": f.get("classe"),
            "aware": f.get("aware"), "apresentacoes": f["apresentacoes"],
            "componente": f["componente"], "fonte": f["fonte"],
            "ajuste": f["ajuste"], "gestacao": f["gestacao"], "alerta": f["alerta"],
            "embedding_text": embedding_farmaco(f),
        })
        arestas.append({"de": "far." + f["id"], "rel": "CATEGORIA", "para": "cat." + f["categoria"]})
        arestas.append({"de": "far." + f["id"], "rel": "COMPONENTE_SUS", "para": f["componente"]})
    for c in CONDICOES:
        nos.append({
            "id": "cond." + c["id"], "tipo": "condicao", "nome": c["nome"], "cid": c["cid"],
            "especialidade": c["especialidade"], "sinonimos": c["sinonimos"],
            "sintomas": c["sintomas"], "diagnostico": c["diagnostico"], "foco": c["foco"],
            "alarmes": c["alarmes"], "nao_fazer": c["nao_fazer"], "fontes": c["fontes"],
            "confianca": c["confianca"], "embedding_text": embedding_condicao(c),
        })
        arestas.append({"de": "cond." + c["id"], "rel": "ESPECIALIDADE", "para": "esp." + c["especialidade"]})
        for alarme in c["alarmes"]:
            arestas.append({"de": "cond." + c["id"], "rel": "ALARME", "para": alarme})
        for fonte in c["fontes"]:
            arestas.append({"de": "cond." + c["id"], "rel": "FONTE", "para": fonte})
        for r in c["receitas"]:
            nos.append({
                "id": "rec." + r["id"], "tipo": "receita", "condicao": c["id"],
                "porta": r["porta"], "imprimivel": r["imprimivel"], "cenario": r["cenario"],
                "linhas": r["linhas"], "duracao": r["duracao"], "quantidade": r["quantidade"],
                "ajustes": r["ajustes"], "alternativa": r["alternativa"],
                "farmacos": r["farmacos"], "confianca": r["confianca"],
                "embedding_text": c["nome"] + ". " + r["cenario"] + " " + " ".join(r["linhas"]) + " " + r["ajustes"],
            })
            arestas.append({"de": "cond." + c["id"], "rel": "TEM_RECEITA", "para": "rec." + r["id"],
                            "porta": r["porta"], "imprimivel": r["imprimivel"]})
            for fid in r["farmacos"]:
                arestas.append({"de": "rec." + r["id"], "rel": "USA_FARMACO", "para": "far." + fid})
    return nos, arestas


def fichas_app():
    saida = []
    for c in CONDICOES:
        saida.append({
            "id": c["id"], "especialidade": c["especialidade"], "nome": c["nome"],
            "cid": c["cid"], "sinonimos": c["sinonimos"], "sintomas": c["sintomas"],
            "diagnostico": c["diagnostico"], "foco": c["foco"], "alarmes": c["alarmes"],
            "nao_fazer": c["nao_fazer"], "fontes": c["fontes"], "confianca": c["confianca"],
            "receitas": c["receitas"],
        })
    return saida


def compendio_md():
    linhas = ["# Compêndio de minutas para prescrição", "",
              "Adulto não gestante. Minuta para o prescritor assinar. Não é receita assinada.",
              "O foco é o tratamento. Sintoma e diagnóstico entram só para travar a receita errada.", ""]
    atual = None
    for c in CONDICOES:
        if c["especialidade"] != atual:
            atual = c["especialidade"]
            linhas += ["", "## " + atual.capitalize(), ""]
        linhas += ["### " + c["nome"] + " (" + c["cid"] + ")", "",
                   "Confiança: " + c["confianca"] + ".", "",
                   "Sintomas: " + "; ".join(c["sintomas"]) + ".", "",
                   "Diagnóstico: " + c["diagnostico"], "",
                   "Tratamento: " + c["foco"], "",
                   "Alarmes: " + "; ".join(c["alarmes"]) + ".", "",
                   "Não fazer: " + "; ".join(c["nao_fazer"]) + ".", ""]
        for r in c["receitas"]:
            selo = "IMPRIMÍVEL NA APS" if r["imprimivel"] else "NÃO IMPRIMIR"
            linhas += ["#### " + r["id"] + " — " + r["porta"] + " — " + selo, "",
                       r["cenario"], ""]
            for item in r["linhas"]:
                linhas.append("- " + item)
            linhas += ["", "Duração: " + r["duracao"] + ". Quantidade: " + r["quantidade"] + ".", "",
                       "Ajuste: " + r["ajustes"], "",
                       "Alternativa: " + r["alternativa"], ""]
        linhas += ["Fontes: " + " | ".join(c["fontes"]), ""]
    return "\n".join(linhas) + "\n"


def farmacos_md():
    linhas = ["# Fármacos por categoria", "",
              "Componente conforme a Rename 2024 quando o trecho foi lido. O restante está marcado para o painel.", ""]
    por = {}
    for f in FARMACOS:
        por.setdefault(f["categoria"], []).append(f)
    for cat in sorted(por):
        linhas += ["## " + cat.capitalize(), ""]
        for f in sorted(por[cat], key=lambda x: x["nome"]):
            aware = (" AWaRe " + f["aware"] + ".") if f.get("aware") else ""
            linhas += ["### " + f["nome"], "",
                       "Classe: " + f.get("classe", "") + ". Componente: " + f["componente"] + "." + aware, "",
                       "Apresentações: " + "; ".join(f["apresentacoes"]) + ".", "",
                       "Ajuste: " + f["ajuste"], "",
                       "Gestação: " + f["gestacao"], "",
                       "Alerta: " + f["alerta"], "",
                       "Fonte: " + f["fonte"], ""]
    return "\n".join(linhas) + "\n"


def gravar_jsonl(caminho, itens):
    with caminho.open("w", encoding="utf-8") as fh:
        for item in itens:
            fh.write(json.dumps(item, ensure_ascii=False) + "\n")


def main():
    erros, avisos = validar()
    nos, arestas = nos_e_arestas()
    fichas = fichas_app()
    DADOS.mkdir(exist_ok=True)
    APP.mkdir(exist_ok=True)
    gravar_jsonl(DADOS / "nos.jsonl", nos)
    gravar_jsonl(DADOS / "arestas.jsonl", arestas)
    (DADOS / "fichas.json").write_text(json.dumps(fichas, ensure_ascii=False, indent=2), encoding="utf-8")
    (APP / "fichas.js").write_text("window.FICHAS = " + json.dumps(fichas, ensure_ascii=False) + ";\n", encoding="utf-8")
    (RAIZ / "COMPENDIO.md").write_text(compendio_md(), encoding="utf-8")
    (RAIZ / "FARMACOS.md").write_text(farmacos_md(), encoding="utf-8")
    relatorio = {
        "condicoes": len(CONDICOES),
        "receitas": sum(len(c["receitas"]) for c in CONDICOES),
        "imprimiveis": sum(1 for c in CONDICOES for r in c["receitas"] if r["imprimivel"]),
        "farmacos": len(FARMACOS),
        "nos": len(nos),
        "arestas": len(arestas),
        "erros": erros,
        "avisos": avisos,
        "embedding_min": min(len(n["embedding_text"]) for n in nos),
    }
    (DADOS / "revisao-automatica.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: relatorio[k] for k in ("condicoes", "receitas", "imprimiveis", "farmacos", "nos", "arestas", "embedding_min")}, ensure_ascii=False))
    print("ERROS", len(erros))
    for e in erros:
        print(" -", e)
    print("AVISOS", len(avisos))
    for a in avisos:
        print(" -", a)
    if erros:
        sys.exit(1)


if __name__ == "__main__":
    main()
