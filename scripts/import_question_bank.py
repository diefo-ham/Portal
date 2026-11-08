"""Normalize user-owned question PDF exports into a private local library.

No network use. Source PDFs are read-only. Generated content stays in private-data/.
Install requirements-pdf.txt with the Python used to run this command.
"""
import argparse
import hashlib
import io
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "private-data/python-deps"))
import pymupdf as fitz
from PIL import Image, ImageChops

PARSER = "college-board-pdf-v1"
ID_RE = re.compile(r"Question ID:\s*([a-zA-Z0-9]+)")
NUMBER = re.compile(r"^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:/[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$")


def normalized_text(text):
    return " ".join(text.replace("\ufffd", " ").replace("\xa0", " ").split())


def index_export(path, cache):
    """Page-to-question segmentation and typed metadata; never infer by page count."""
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    cache_file = cache / f"{digest}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))
    doc = fitz.open(path)
    records = []
    for i, page in enumerate(doc):
        text = page.get_text()
        match = ID_RE.search(text)
        if match:
            words = page.get_text("words")
            headings = [w for w in words if w[4] == "Question" and w[0] < 25 and w[1] > 70]
            if not headings:
                raise ValueError(f"Missing question boundary in {path.name}, page {i+1}")
            top = headings[0][1]
            def column(left, right):
                return normalized_text(" ".join(w[4] for w in words if left <= w[0] < right and 75 < w[1] < top-4))
            records.append({"id":match[1].lower(),"startPage":i+1,"pages":[],"texts":[],"section":column(130,245),"domain":column(245,360),"skill":column(360,480),"difficulty":column(480,600)})
        if not records:
            raise ValueError(f"Unassigned page {i+1} in {path.name}")
        records[-1]["pages"].append(i+1)
        records[-1]["texts"].append(text)
        if (i+1) % 100 == 0:
            print(f"Index {path.name}: {i+1}/{len(doc)} pages", flush=True)
    data = {"filename":path.name,"sha256":digest,"pages":len(doc),"records":records}
    cache_file.write_text(json.dumps(data),encoding="utf-8")
    doc.close()
    return data


def save_crop(page, box, assets):
    # Hide annotations: user highlights can otherwise reveal the correct option.
    pix = page.get_pixmap(matrix=fitz.Matrix(2,2),clip=box,alpha=False,annots=False)
    image = Image.frombytes("RGB", (pix.width,pix.height), pix.samples)
    bounds=ImageChops.difference(image,Image.new('RGB',image.size,'white')).getbbox()
    if bounds:
        image=image.crop((0,max(0,bounds[1]-8),image.width,min(image.height,bounds[3]+8)))
    return save_image(image,assets)


def save_image(image, assets):
    output = io.BytesIO()
    image.save(output, format="WEBP", lossless=True, method=3)
    content = output.getvalue()
    digest = hashlib.sha256(content).hexdigest()
    name = digest + ".webp"
    target = assets / name
    if not target.exists():
        target.write_bytes(content)
    return {"src":"asset:"+name,"alt":"Original question content", "width":image.width,"height":image.height}


def upgrade_cached_layout(q, record, doc, assets):
    """Recheck tight crop edges and trim blank space without repeating PDF extraction."""
    if q.get('_layoutCacheVersion')==2:return
    for kind in ['question','rationale']:
        for i,panel in enumerate(q['document'][kind]):
            image=Image.open(assets/panel['src'][6:]).convert('RGB')
            bounds=ImageChops.difference(image,Image.new('RGB',image.size,'white')).getbbox()
            if bounds and (bounds[1]<4 or bounds[3]>image.height-4):
                page_num=int(re.search(r'source page (\d+)',panel['alt'])[1])
                page=doc[page_num-1]
                keys=page.search_for('Correct Answer:')
                rationales=[r for r in page.search_for('Rationale') if r.x0<25 and r.y0>70]
                boundary=keys[0] if keys else rationales[0] if rationales else None
                start=0
                end=page.rect.height
                if kind=='question':
                    if page_num==record['pages'][0]:
                        headings=[r for r in page.search_for('Question') if r.x0<25 and r.y0>70]
                        start=headings[0].y1+0.2
                    if boundary:end=boundary.y0-1
                elif boundary:start=keys[0].y1+6 if keys else boundary.y0-2
                updated=save_crop(page,fitz.Rect(16,start,page.rect.width-16,end),assets)
            else:
                if bounds:image=image.crop((0,max(0,bounds[1]-8),image.width,min(image.height,bounds[3]+8)))
                updated=save_image(image,assets)
            updated['alt']=panel['alt'];q['document'][kind][i]=updated
    q['_layoutCacheVersion']=2


def extract_answer(joined):
    keys=re.findall(r"Correct Answer:\s*([^\n]+)",joined)
    origin='answer-key'
    rationale=normalized_text(re.split(r'(?:^|\n)Rationale\n',joined,maxsplit=1)[-1])
    examples=re.search(r'Note that ([+\-0-9.,/ andor]+) (?:are examples|is an example) of ways to enter a correct answer',rationale)
    if len(keys)>1:
        raise ValueError('Multiple answer keys')
    if keys:
        key=keys[0].strip().replace('\u2212','-')
        if key in 'ABCD' and len(key)==1: return {'type':'choice','value':key},origin
        accepted=[v.strip() for v in key.split(',')]
    else:
        origin='rationale'
        # Some official exports omit a separate key. Use only an explicit correct-answer
        # statement or list of accepted entries in the rationale, never solve or guess.
        choice=re.match(r'Choice ([A-D]) is (?:correct|the best answer)\.',rationale)
        if choice:return {'type':'choice','value':choice[1]},origin
        if examples:
            accepted=re.findall(r'[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:/\d+)?',examples[1])
        else:
            numeric=re.match(r'The correct answer is ([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|[+-]?\.\d+)\.',rationale)
            if not numeric: raise ValueError('No explicit machine-readable correct answer')
            accepted=[numeric[1].replace(',','')]
    if examples:
        accepted=list(dict.fromkeys(accepted+re.findall(r'[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:/\d+)?',examples[1])))
    if not accepted or any(not NUMBER.fullmatch(v) or ('/' in v and float(v.split('/')[1])==0) for v in accepted):
        raise ValueError(f'Unsupported numeric answer: {accepted!r}')
    return {'type':'numeric','accepted':accepted},origin


def convert(record, doc, assets, override=None):
    texts = record["texts"]
    joined = "\n".join(texts)
    answer,origin=extract_answer(joined)
    section = {"Math":"math","Reading and Writing":"reading-writing"}.get(record["section"])
    if not section or record["difficulty"].lower() not in ["easy","medium","hard"] or not record["domain"] or not record["skill"]:
        raise ValueError("Missing or unrecognized metadata")
    panels = {"question":[],"rationale":[]}
    found_key = False
    for i, page_num in enumerate(record["pages"]):
        page = doc[page_num-1]
        key_boxes = page.search_for("Correct Answer:")
        key_box = key_boxes[0] if key_boxes else None
        rationale_boxes=[r for r in page.search_for('Rationale') if r.x0<25 and r.y0>70]
        rationale_box=rationale_boxes[0] if rationale_boxes else None
        boundary=key_box or rationale_box
        start = 0.0
        if i==0:
            headings = [r for r in page.search_for("Question") if r.x0<25 and r.y0>70]
            if not headings:
                raise ValueError("Cannot locate question crop boundary")
            start = headings[0].y1 + 0.2
        end = page.rect.height
        if not found_key:
            question_end = boundary.y0-1 if boundary else end
            if question_end > start+2:
                panel = save_crop(page,fitz.Rect(16,start,page.rect.width-16,question_end),assets)
                panel["alt"] = f"Question {record['id']}, source page {page_num}. Original layout includes any answer choices."
                panels["question"].append(panel)
        if boundary:
            if found_key:
                raise ValueError("Multiple visual answer key boundaries")
            found_key = True
            start = key_box.y1+6 if key_box else rationale_box.y0-2
        if found_key and end > start+2:
            panel = save_crop(page,fitz.Rect(16,start,page.rect.width-16,end),assets)
            panel["alt"] = f"Explanation for {record['id']}, source page {page_num}."
            panels["rationale"].append(panel)
    if not found_key or not panels["question"] or not panels["rationale"]:
        raise ValueError("Incomplete question/explanation crop boundaries")
    body = joined.split("\nQuestion\n",1)[-1].split("Correct Answer:",1)[0].split('\nRationale\n',1)[0]
    stem = normalized_text(body.split("\nAnswer\n",1)[0])
    rationale = normalized_text(joined.split("\nRationale\n",1)[-1])
    q = {"id":"cb-"+record["id"],"sourceId":record["id"],"source":"College Board SAT question bank","section":section,"domain":record["domain"],"skill":record["skill"].replace("Cross-text", "Cross-Text"),"difficulty":record["difficulty"].lower(),"stem":stem or "Original PDF question "+record["id"],"answer":answer,"rationale":rationale,"testStatus":"unknown","document":{**panels,"textIsApproximate":True,"answerKeyOrigin":origin,"provenance":[]}}
    if answer["type"] == "choice":
        option_body=body.split('\nAnswer\n',1)[-1]
        labels = re.findall(r"(?m)^([A-D])\.\s*",option_body)
        if labels[:4] != ["A","B","C","D"] and not (override or {}).get('choiceLabelsVerified'):
            raise ValueError(f"Expected options A-D in order, found {labels}")
        q["choices"] = [{"id":c,"text":"Option "+c} for c in "ABCD"]
    return q


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-directory", type=Path, required=True)
    parser.add_argument("--output-directory",type=Path,default=ROOT/"private-data/library")
    parser.add_argument("--active-mode",choices=["inclusive","active-only","unknown"],default="unknown")
    parser.add_argument('--overrides',type=Path,default=ROOT/'private-data/pdf-overrides.json',help='Private, manually reviewed source exceptions')
    args = parser.parse_args()
    overrides=json.loads(args.overrides.read_text(encoding='utf-8')) if args.overrides.exists() else {}
    output=args.output_directory.resolve()
    if not output.is_relative_to((ROOT/"private-data").resolve()):
        parser.error("Write imported copyrighted content only under private-data/.")
    assets=output/"assets"; assets.mkdir(parents=True,exist_ok=True)
    cache=ROOT/"private-data/pdf-cache"; cache.mkdir(parents=True,exist_ok=True)
    indexes={}
    for name in ["read_write_inactive","read_write_active","math_inactive","math_active"]:
        indexes[name]=index_export(args.input_directory/(name+".pdf"),cache)
        print(f"Indexed {name}: {len(indexes[name]['records'])} questions",flush=True)
    report={"parser":PARSER,"createdAt":datetime.now(timezone.utc).isoformat(),"activeMode":args.active_mode,"files":[],"comparison":{},"quarantined":[],"conflicts":[]}
    # Source IDs, not page numbers or fuzzy text, establish identity.
    collected={}
    for name, index in indexes.items():
        report["files"].append({k:index[k] for k in ["filename","sha256","pages"]}|{"questions":len(index["records"])})
        for record in index["records"]:
            collected.setdefault(record["id"],[]).append((name,record))
    statuses={}
    for prefix in ["read_write","math"]:
        inactive={r["id"] for r in indexes[prefix+"_inactive"]["records"]}
        active={r["id"] for r in indexes[prefix+"_active"]["records"]}
        report["comparison"][prefix]={"both":len(inactive&active),"inactiveFileOnly":len(inactive-active),"activeFileOnly":len(active-inactive)}
        for id_ in inactive|active:
            statuses[id_] = "inactive" if id_ in inactive else "active" if args.active_mode!="unknown" else "unknown"
        if args.active_mode=="inclusive" and inactive-active:
            # An inclusive/exclusive comparison is invalid when the claimed superset is incomplete.
            for id_ in active-inactive: statuses[id_]="unknown"
            report["conflicts"].append({"section":prefix,"reason":"Inactive export is not a subset of the claimed inclusive export. Inclusive-only IDs left unknown."})
        if args.active_mode=="active-only":
            for id_ in inactive&active: statuses[id_]="unknown"
    docs={name:fitz.open(args.input_directory/(name+".pdf")) for name in indexes}
    questions=[]
    for i,(id_, occurrences) in enumerate(collected.items()):
        name, record = occurrences[0]
        signatures={(r["section"],r["domain"],r["skill"].lower(),r["difficulty"],tuple(re.findall(r"Correct Answer:\s*([^\n]+)","\n".join(r["texts"])))) for _,r in occurrences}
        try:
            if len(signatures)>1:
                raise ValueError("Same source ID has conflicting metadata or answer keys")
            converted_cache=cache/(PARSER+'-'+indexes[name]['sha256']+'-'+id_+'.json')
            if converted_cache.exists():
                q=json.loads(converted_cache.read_text(encoding='utf-8'))
                upgrade_cached_layout(q,record,docs[name],assets)
            else:
                q=convert(record,docs[name],assets,overrides.get(id_))
                q['_layoutCacheVersion']=2
            converted_cache.write_text(json.dumps(q),encoding='utf-8')
            q['answer'],origin=extract_answer('\n'.join(record['texts']))
            q['document']['answerKeyOrigin']=origin
            if overrides.get(id_,{}).get('warning'):
                q['document']['extractionWarnings']=[overrides[id_]['warning']]
            q["testStatus"]=statuses[id_]
            q['skill']=q['skill'].replace('propor tional','proportional')
            q["document"]["provenance"]=[{"filename":indexes[n]["filename"],"sha256":indexes[n]["sha256"],"pages":r["pages"]} for n,r in occurrences]
            questions.append({k:v for k,v in q.items() if not k.startswith('_')})
        except Exception as error:
            report["quarantined"].append({"sourceId":id_,"file":name+".pdf","pages":record["pages"],"reason":str(error)})
        if (i+1)%100==0: print(f"Prepared {i+1}/{len(collected)} source IDs",flush=True)
    for doc in docs.values(): doc.close()
    report["uniqueSourceIds"]=len(collected)
    report["importedQuestions"]=len(questions)
    report["counts"]={"section":dict(Counter(q["section"] for q in questions)),"testStatus":dict(Counter(q["testStatus"] for q in questions)),"difficulty":dict(Counter(q["difficulty"] for q in questions))}
    payload=json.dumps({"schemaVersion":1,"questions":questions},ensure_ascii=False,separators=(",",":"))
    revision=hashlib.sha256(payload.encode()).hexdigest()
    (output/"questions.json").write_text(payload,encoding="utf-8")
    used_assets=sorted({p["src"].removeprefix("asset:") for q in questions for kind in ["question","rationale"] for p in q["document"][kind]})
    manifest={"format":"sat-study-local-library-v1","revision":revision,"label":"PDF imports","questionCount":len(questions),"assets":used_assets,"summary":report["counts"]}
    (output/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    (output/"import-report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps({"questions":len(questions),"quarantined":len(report["quarantined"]),"counts":report["counts"],"comparison":report["comparison"],"output":str(output)}),flush=True)

if __name__=="__main__": main()
