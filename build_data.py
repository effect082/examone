import csv
import json
import os
from bs4 import BeautifulSoup

def build_ox_data():
    csv_path = 'OX퀴즈_템플릿.csv'
    out_path = 'data/ox_data.json'
    
    ox_data = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ox_data.append({
                'category': row.get('분류', '').strip(),
                'number': row.get('번호', '').strip(),
                'question': row.get('문제', '').strip(),
                'answer': row.get('정답', '').strip(),
                'explanation': row.get('오답해설', '').strip()
            })
            
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(ox_data, f, ensure_ascii=False, indent=2)
    print(f"✅ Generated {out_path} with {len(ox_data)} questions.")

def build_exam_data():
    html_path = '사회복지사1급_기출문제.html'
    out_path = 'data/exam_data.json'
    
    with open(html_path, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
        
    exams = []
    sections = soup.find_all('div', class_='sec')
    for sec in sections:
        sec_id = sec.get('id', '')
        
        h2 = sec.find('h2')
        title = h2.text.strip() if h2 else ""
        
        sub_tags_div = sec.find('div', class_='sub-tags')
        subjects = [t.text.strip() for t in sub_tags_div.find_all('span', class_='sub-tag')] if sub_tags_div else []
        
        subject = title.split('—')[-1].strip() if '—' in title else ""
        
        answers = {}
        ans_sheet = sec.find('div', class_='ans-sheet')
        if ans_sheet:
            tds = ans_sheet.find_all('td')
            for i, td in enumerate(tds):
                answers[i+1] = td.text.strip()
                
        questions = []
        qcs = sec.find_all('div', class_='qc')
        for qc in qcs:
            qnum_div = qc.find('div', class_='qnum')
            qnum_text = qnum_div.text.strip().replace('.', '') if qnum_div else ""
            qnum = int(qnum_text) if qnum_text.isdigit() else 0
            
            qtxt_div = qc.find('div', class_='q-txt')
            # remove line breaks in question text and clean it
            qtxt = " ".join(qtxt_div.stripped_strings) if qtxt_div else ""
            
            opts = []
            q_opts = qc.find_all('div', class_='q-opt')
            for opt in q_opts:
                opt_text = " ".join(opt.stripped_strings)
                opts.append(opt_text)
                
            ans_badge = qc.find('div', class_='ans-badge')
            ans_text = ans_badge.text.strip() if ans_badge else ""
            
            correct_ans = answers.get(qnum, '')
            
            questions.append({
                'qnum': qnum,
                'question': qtxt,
                'options': opts,
                'correct_answer': correct_ans,
                'explanation': f"정답은 {correct_ans}번입니다. 문제의 핵심 내용을 파악하여 정답을 선택해 주세요."
            })
            
        exams.append({
            'id': sec_id,
            'title': title,
            'subjects': subjects,
            'section_subject': subject,
            'questions': questions
        })
        
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(exams, f, ensure_ascii=False, indent=2)
    print(f"✅ Generated {out_path} with {len(exams)} sections.")

if __name__ == '__main__':
    os.makedirs('data', exist_ok=True)
    # build_ox_data()
    build_exam_data()
