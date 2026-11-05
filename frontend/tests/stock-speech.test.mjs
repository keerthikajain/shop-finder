import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStockSpeech} from '../src/stock-speech.js';
test('stock speech produces a draft quantity, including explicit zero counts',()=>{
 assert.deepEqual(parseStockSpeech('Receive five units.'),{operation:'receive',quantity:5});
 assert.deepEqual(parseStockSpeech('count zero'),{operation:'count',quantity:0});
 assert.deepEqual(parseStockSpeech('Move 12 pieces'),{operation:'move',quantity:12});
});
test('ambiguous, fractional or multi-command stock speech is not guessed',()=>{
 for(const text of ['receive 2 or 3','remove -2','count 1.5','move 3 and remove 4','move five to shelf 2','receive many','receive 1000000001','find red dress'])assert.equal(parseStockSpeech(text),null,text);
});
