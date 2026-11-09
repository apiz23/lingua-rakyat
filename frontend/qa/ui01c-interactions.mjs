import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:375,height:900}});const results=[];
async function check(name, action){try{await action();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message})}}
await page.goto('http://127.0.0.1:3000/about',{waitUntil:'domcontentloaded'});
await check('About section navigation',async()=>{await page.locator('a[href="#api"]').click();if(!page.url().endsWith('#api'))throw Error('anchor not reached')});
await check('Keyboard focus visible',async()=>{await page.locator('a[href="#api"]').focus();await page.keyboard.press('Tab');const v=await page.evaluate(()=>({tag:document.activeElement.tagName,outline:getComputedStyle(document.activeElement).outlineStyle}));if(v.tag==='BODY'||v.outline==='none')throw Error(JSON.stringify(v))});
await page.goto('http://127.0.0.1:3000/workspace',{waitUntil:'domcontentloaded'});
console.log('BUTTONS',await page.getByRole('button').allTextContents());
await check('Mobile sidebar open and Escape',async()=>{await page.getByRole('button',{name:'Toggle Sidebar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'visible',timeout:5000});await page.waitForTimeout(700);await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'hidden',timeout:5000})});
await page.goto('http://127.0.0.1:3000/manage',{waitUntil:'domcontentloaded'});
await check('Admin signed-out redirect',async()=>{await page.waitForURL(/sign-in/);if(!page.url().includes('redirect_url'))throw Error('missing return destination')});
await page.goto('http://127.0.0.1:3000/eval',{waitUntil:'domcontentloaded'});
await check('Research section selector',async()=>{const b=page.locator('nav[aria-label] button[aria-pressed]').nth(1);await b.click();await page.waitForFunction(()=>document.querySelectorAll('nav[aria-label] button[aria-pressed]')[1]?.getAttribute('aria-pressed')==='true')});
await writeFile('qa/ui01c-interactions.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
