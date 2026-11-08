"""Synthetic-only PDF regression tests. Temporary artifacts live outside OneDrive."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('importer',Path(__file__).with_name('import_question_bank.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
fitz=module.fitz

class PdfImportTests(unittest.TestCase):
    def test_question_crops_hide_annotations_and_separate_answer_key(self):
        with tempfile.TemporaryDirectory(prefix='sat-pdf-test-') as folder:
            doc=fitz.open();p=doc.new_page(width=612,height=792)
            p.insert_text((18,140),'Question',fontsize=12)
            heading_bottom=p.search_for('Question')[0].y1
            # Vector math can begin immediately after the heading. A six-point
            # margin used by an earlier crop would remove this entire numerator.
            p.draw_rect(fitz.Rect(200,heading_bottom+2,250,heading_bottom+5),color=None,fill=(0,0,0))
            p.insert_text((18,180),'What is 2 + 2?',fontsize=12)
            for i,c in enumerate('ABCD'):p.insert_text((18,210+i*20),f'{c}. {i+2}',fontsize=12)
            p.insert_text((18,310),'Correct Answer: C',fontsize=12)
            p.insert_text((18,340),'Rationale',fontsize=12)
            p.insert_text((18,370),'Two plus two is four.',fontsize=12)
            p.add_highlight_annot(p.search_for('C. 4'))
            record={'id':'synthetic01','pages':[1],'texts':['Question ID: synthetic01\nQuestion\nWhat is 2 + 2?\nAnswer\nA. 2\nB. 3\nC. 4\nD. 5\nCorrect Answer: C\nRationale\nTwo plus two is four.'],'section':'Math','domain':'Algebra','skill':'Linear functions','difficulty':'Easy'}
            q=module.convert(record,doc,Path(folder))
            self.assertEqual(q['answer'],{'type':'choice','value':'C'})
            panel=q['document']['question'][0]
            image=module.Image.open(Path(folder)/panel['src'][6:]).convert('RGB')
            self.assertFalse(any(r>200 and g>200 and b<150 for r,g,b in image.get_flattened_data()),'A yellow answer highlight leaked into the question crop')
            self.assertLess(panel['height'],400,'The answer-key area leaked into the question crop')
            self.assertGreaterEqual(sum(max(image.getpixel((400,y)))<20 for y in range(20)),5,'A tight equation numerator was clipped')
            doc.close()

    def test_invalid_numeric_keys_are_quarantined_instead_of_guessed(self):
        record={'texts':['Correct Answer: unknown'], 'pages':[1]}
        with self.assertRaises(ValueError):module.convert(record,None,Path('.'))

    def test_explicit_rationale_answers_and_accepted_rounding_variants(self):
        self.assertEqual(module.extract_answer('Rationale\nThe correct answer is 3,540. Explanation.'),({'type':'numeric','accepted':['3540']},'rationale'))
        self.assertEqual(module.extract_answer('Rationale\nChoice B is correct. Explanation.'),({'type':'choice','value':'B'},'rationale'))
        value,origin=module.extract_answer('Correct Answer: 3/17\nRationale\nNote that 3/17, .1764, .1765, and 0.176 are examples of ways to enter a correct answer.')
        self.assertEqual(value['accepted'],['3/17','.1764','.1765','0.176'])
        self.assertEqual(origin,'answer-key')

if __name__=='__main__':unittest.main()
