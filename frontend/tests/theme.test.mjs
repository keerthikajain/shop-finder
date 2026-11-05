import test from 'node:test';
import assert from 'node:assert/strict';
import {getThemePreference,resolveTheme} from '../src/theme.js';
test('theme follows system changes only when system is selected',()=>{
 assert.equal(resolveTheme('system',true),'dark');assert.equal(resolveTheme('system',false),'light');
 assert.equal(resolveTheme('light',true),'light');assert.equal(resolveTheme('dark',false),'dark');
});
test('invalid or unavailable theme storage keeps the reference light theme',()=>{
 assert.equal(getThemePreference({getItem:()=>null}),'light');
 assert.equal(getThemePreference({getItem:()=>'<script>'}),'light');
 assert.equal(getThemePreference({getItem:()=>{throw Error()}}),'light');
 assert.equal(getThemePreference({getItem:()=> 'dark'}),'dark');
});
