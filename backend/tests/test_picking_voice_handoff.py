import pytest
from app.warehouse_voice_guide import guide

@pytest.mark.parametrize(('language','expected'),[
 ('en-IN','Tell me when you find it'),
 ('hi-IN','सामान मिल जाए तो बताइए'),
 ('hi-en','Mil jaye to bolo'),
 ('te-IN','వస్తువు దొరికినప్పుడు చెప్పండి'),
 ('kn-IN','ವಸ್ತು ಸಿಕ್ಕಿದಾಗ ಹೇಳಿ'),
])
@pytest.mark.parametrize('action',['start','next','repeat'])
def test_location_guidance_prompts_for_found_item_and_repeat(language,expected,action):
 task={
  'language':language,
  'picking':{'status':'active','paused':False},
  'lines':[{'selected':{'name':'Red dress','sku':'CLO-008'},
            'location':{'rack':'2','shelf':'D'},'complete':False}]
 }
 def check_line(index):
  assert index==0
 result=guide(task,action,0,check_line)
 assert result['action']==action
 assert result['line']==0
 assert 'CLO-008' in result['text']
 assert expected in result['text']

def test_confirmation_does_not_get_extra_location_prompt():
 task={'language':'en-IN','picking':{'status':'active'},
       'lines':[{'selected':{'name':'Red dress','sku':'CLO-008'},
                 'location':{'rack':'2'},'complete':False}]}
 result=guide(task,'verify',0,lambda idx:None)
 assert 'Did you pick' in result['text']
 assert 'Tell me when you find it' not in result['text']
