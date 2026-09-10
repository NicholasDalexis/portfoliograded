import { describe,expect,it } from 'vitest';
import { load } from 'cheerio';
import { TEMPLATE_IDS,createEmptyPortfolioDraft,exportPortfolioHTML,validateEditablePortfolioDraft } from '../shared/portfolio';
import { getTemplateDemo,getTemplatePreviewHTML,templateMetadata } from '../shared/portfolioTemplateDemos';

describe('distinct portfolio templates and editor contract',()=>{
 it.each(TEMPLATE_IDS)('%s keeps preview samples separate from author data',template=>{
  const demo=getTemplateDemo(template);
  const $=load(getTemplatePreviewHTML(template));
  expect(demo.template).toBe(template);
  expect($('body').attr('data-template-demo')).toBe('true');
  expect($('body').text()).toContain('TEMPLATE PREVIEW · EXAMPLE CONTENT');
  expect(createEmptyPortfolioDraft(template).name).toBe('');
  expect(createEmptyPortfolioDraft(template).projects).toEqual([]);
  const authored=exportPortfolioHTML({...createEmptyPortfolioDraft(template),name:'Actual author'});
  expect(authored).not.toContain('Alex Morgan');
  expect(authored).not.toContain('Groundwork');
  expect(authored).not.toContain('hello@example.com');
 });
 it.each(TEMPLATE_IDS)('%s exposes inert editor selection anchors and native case studies',template=>{
  const draft=getTemplateDemo(template); const $=load(exportPortfolioHTML(draft));
  expect($('[data-pg-section="about"]').length).toBeGreaterThan(0);
  expect($('[data-pg-section="work"]').length).toBe(1);
  expect($('[data-pg-section="contact"]').length).toBe(1);
  expect($('[data-pg-project]').map((_,node)=>$(node).attr('data-pg-project')).get()).toEqual(draft.projects.map(p=>p.id));
  expect($('article details summary').length).toBe(3);
  for(const project of draft.projects) expect($('article').text()).toContain(project.process);
  expect($('script,[onclick],[onload]').length).toBe(0);
 });
 it.each(TEMPLATE_IDS)('%s keeps abstract covers decorative and does not invent supplied work',template=>{
  const draft=getTemplateDemo(template); const $=load(exportPortfolioHTML(draft));
  expect($('.cover[aria-hidden="true"]').length).toBe(3);
  expect($('img').length).toBe(0);
  expect($('article h3').map((_,node)=>$(node).text()).get()).toEqual(draft.projects.map(p=>p.title));
  expect($('[src]').length).toBe(0);
  expect($('meta[http-equiv="Content-Security-Policy"]').attr('content')).toContain("connect-src 'none'");
 });
 it.each(TEMPLATE_IDS)('%s rejects incomplete editable contacts before rendering',template=>{
  const editable=validateEditablePortfolioDraft({...getTemplateDemo(template),email:'hello@',links:[{id:'unfinished',label:'Link',url:'javascript:alert(1)'}]});
  expect(()=>exportPortfolioHTML(editable)).toThrow();
 });
 it('matches metadata to the three real renderers with fresh independent demo objects',()=>{
  expect(templateMetadata.map(t=>t.id)).toEqual([...TEMPLATE_IDS]);
  const a=getTemplateDemo('editorial');a.projects[0].title='Changed';
  expect(getTemplateDemo('editorial').projects[0].title).toBe('Groundwork');
  const html=TEMPLATE_IDS.map(t=>exportPortfolioHTML(getTemplateDemo(t)));
  expect(new Set(html).size).toBe(3);
 });
});
