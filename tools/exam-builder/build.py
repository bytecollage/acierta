"""Genera data/<código>/{questions,answers}.json desde un archivo fuente (p. ej. data/N1E02/).

Uso: python3 -I build.py exams/n6.py [--write]

La fuente define PC, CL, RI, PM, EN_ST, EN (ver n6.py). En cada pregunta la opción
correcta va primero; aquí se le asigna una letra con la clave equilibrada (50/50/50),
sin rachas de más de 3 letras iguales y repartida dentro de cada área.
"""
import json, os, random, sys, math, fractions, collections

WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "web", "data") + "/"
SUB = {
    "Pensamiento científico": {
        "I": "Identificación de variables, conceptos y procesos",
        "R": "Relación con procesos y consecuencias en la sociedad",
        "A": "Interpretación y argumentación desde evidencias"},
    "Comprensión lectora": {
        "ID": "Identificación de información",
        "IN": "Interpretación",
        "EV": "Evaluación de la forma y el contenido"},
    "Redacción indirecta": {
        "C": "Comunicativa", "G": "Gramatical y semántica", "O": "Ortográfica"},
    "Pensamiento matemático": {
        "CM": "Comprensión de lo matemático", "DU": "Desarrollo de usos"},
    "Inglés": {"R": "Comprensión lectora", "W": "Redacción indirecta"},
}
TARGET = {"Pensamiento científico": 28, "Comprensión lectora": 28,
          "Redacción indirecta": 28, "Pensamiento matemático": 38, "Inglés": 28}


def load(path):
    ns = {"math": math, "Fraction": fractions.Fraction}
    exec(open(path, encoding="utf-8").read(), ns)
    return ns


def flatten(ns):
    items, stimuli = [], []
    def add(area, t, stim=None):
        sub, topic, text, c, w1, w2 = t[:6]
        check = t[6] if len(t) > 6 else None
        items.append(dict(area=area, subarea=SUB[area][sub], topic=topic, text=text,
                          correct=c, wrong=[w1, w2], check=check, stimulusId=stim))
    for t in ns["PC"]: add("Pensamiento científico", t)
    for s in ns["CL"]:
        stimuli.append(dict(id=s["id"], area="Comprensión lectora",
                            instruction=s["instruction"], text=s["text"]))
        for t in s["qs"]: add("Comprensión lectora", t, s["id"])
    for t in ns["RI"]: add("Redacción indirecta", t)
    for t in ns["PM"]: add("Pensamiento matemático", t)
    for s in ns["EN_ST"]:
        stimuli.append(dict(id=s["id"], area="Inglés",
                            instruction=s["instruction"], text=s["text"]))
        for t in s["qs"]: add("Inglés", t, s["id"])
    for t in ns["EN"]: add("Inglés", t)
    return items, stimuli


def assign_letters(items, seed):
    rng = random.Random(seed)
    n = len(items)
    base = (["A", "B", "C"] * (n // 3 + 1))[:n]
    areas = [it["area"] for it in items]
    for _ in range(200000):
        rng.shuffle(base)
        run, ok = 1, True
        for i in range(1, n):
            run = run + 1 if base[i] == base[i - 1] else 1
            if run > 3: ok = False; break
        if not ok: continue
        for a in TARGET:
            c = collections.Counter(l for l, ar in zip(base, areas) if ar == a)
            m = sum(c.values()) / 3
            if any(abs(c[k] - m) > 2 for k in "ABC"): ok = False; break
        if ok: return base[:]
    raise SystemExit("no se encontró una clave equilibrada")


def main():
    src = sys.argv[1]
    ns = load(src)
    level = ns["LEVEL"]
    # Código N<nivel>E<examen>: los diagnósticos 1–5 son N0E01–N0E05 y los 6–10, N1E01–N1E05.
    # Es el id del examen en todas partes (catálogo, carpeta, URL, hoja y cadena).
    exam_id = f"N{(level - 1) // 5}E{(level - 1) % 5 + 1:02d}"
    items, stimuli = flatten(ns)
    errs = []

    counts = collections.Counter(it["area"] for it in items)
    for a, n in TARGET.items():
        if counts[a] != n: errs.append(f"{a}: {counts[a]} preguntas, se esperaban {n}")
    for i, it in enumerate(items):
        opts = [it["correct"]] + it["wrong"]
        if len(set(o.strip() for o in opts)) != 3: errs.append(f"#{i+1} opciones repetidas: {opts}")
        if any(not str(o).strip() for o in opts): errs.append(f"#{i+1} opción vacía")
        if it["check"] is not None:
            try:
                if eval(it["check"], {"math": math, "Fraction": fractions.Fraction}) is not True:
                    errs.append(f"#{i+1} CHECK FALLA: {it['check']}  ({it['text'][:60]})")
            except Exception as e:
                errs.append(f"#{i+1} CHECK ERROR {e}: {it['check']}")
    texts = [it["text"] for it in items if not it["stimulusId"]]
    dup = [t for t, c in collections.Counter(texts).items() if c > 1 and len(t) > 40]
    if dup: errs.append(f"enunciados duplicados: {dup}")
    if errs:
        print("\n".join(errs)); sys.exit(1)

    letters = assign_letters(items, seed=1000 + level)
    rng = random.Random(level)
    questions, answers, longest = [], [], 0
    for i, (it, L) in enumerate(zip(items, letters), start=1):
        wrong = it["wrong"][:]; rng.shuffle(wrong)
        others = [k for k in "ABC" if k != L]
        options = {L: it["correct"], others[0]: wrong[0], others[1]: wrong[1]}
        options = {k: options[k] for k in "ABC"}
        if len(it["correct"]) > max(len(w) for w in it["wrong"]): longest += 1
        q = {"id": i, "area": it["area"], "subarea": it["subarea"], "topic": it["topic"]}
        if it["stimulusId"]: q["stimulusId"] = it["stimulusId"]
        q["text"] = it["text"]; q["options"] = options
        questions.append(q)
        answers.append({"id": i, "correctAnswer": L})

    areas, start = [], 1
    for a in TARGET:
        areas.append({"name": a, "start": start, "end": start + TARGET[a] - 1}); start += TARGET[a]
    title = f"Examen {exam_id}"
    qdoc = {"exam": {"id": exam_id, "title": title, "version": "2.0",
                     "questionCount": len(questions), "areas": areas},
            "stimuli": stimuli, "questions": questions}
    adoc = {"examId": exam_id, "version": "2.0", "answers": answers}

    dist = collections.Counter(letters)
    print(f"{exam_id}: {len(questions)} preguntas, {len(stimuli)} estímulos, clave {dict(dist)}, "
          f"correcta = opción más larga en {longest} ({longest/len(items):.0%}), "
          f"comprobaciones numéricas: {sum(1 for it in items if it['check'])}")
    print("  temas:", len(set(it['topic'] for it in items)),
          "| subáreas:", dict(collections.Counter(it['subarea'] for it in items)))

    if "--write" in sys.argv:
        d = os.path.join(WEB, exam_id); os.makedirs(d, exist_ok=True)
        json.dump(qdoc, open(os.path.join(d, "questions.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        json.dump(adoc, open(os.path.join(d, "answers.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        cat_path = os.path.join(WEB, "exams.json")
        cat = json.load(open(cat_path, encoding="utf-8"))
        entry = {"id": exam_id, "title": title, "version": "2.0", "questionCount": len(questions),
                 "estimatedMinutes": 255,
                 "questions": f"{exam_id}/questions.json", "answers": f"{exam_id}/answers.json"}
        cat = [c for c in cat if c["id"] != exam_id] + [entry]
        json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print("  escrito en", d)


main()
