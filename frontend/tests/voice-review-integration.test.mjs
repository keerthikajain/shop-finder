import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('voice and manual actions coexist for picking undo',async()=>{
 const source=await readFile(new URL('../src/warehouse.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("'/picking/undo'")||source.includes("'/picking/undo'")); // endpoint path
 assert.ok(source.includes("voiceAction(source.language,'undo',transcript)"));
 assert.ok(source.includes("onClick={()=>undoPick(lastConfirmedIndex)}"));
 assert.ok(source.includes("label={pickingUiCopy(appLanguage,'sayUndo')}"));
 assert.ok(source.includes("if(voice&&auto&&!voiceFlowStopped.current)await playPickGuidance('repeat',next,line)"));
});

test('location corrections accept spoken location and reason but cannot skip approval',async()=>{
 const source=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 assert.ok(source.includes('onText={hearCorrection}'));
 assert.ok(source.includes("label={t('Dictate reason')}"));
 assert.ok(source.includes("voiceAction(language,'preview',text)"));
 assert.ok(source.includes("onClick={confirmMove}"));
 assert.ok(source.includes("voiceAction(language,'move',text)"));
 assert.ok(source.includes("onText={spokenMoveConfirmation}"));
 assert.ok(source.includes("playReviewAudio('moves/'"));
});

test('location review voice is readback plus explicit approval with manual alternative',async()=>{
 const source=await readFile(new URL('../src/warehouse-manage.jsx',import.meta.url),'utf8');
 assert.ok(source.includes("playReviewAudio('issues/'"));
 assert.ok(source.includes("onText={spokenResolutionChoice}"));
 assert.ok(source.includes("onText={spokenReviewSubmit}"));
 assert.ok(source.includes("action:'confirmed_original',revision:current.revision"));
 assert.ok(source.includes("action:'unconfirmed'"));
 assert.ok(source.includes("type=\"submit\" className=\"primary\""));
});
