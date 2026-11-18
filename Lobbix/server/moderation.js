/** SafeGuard 2.0: deterministic text rules. Screen video and drawings use member reports. */
export const VERSION = '2.0.0';
export function normalize(value) {
  return String(value).normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'')
    .toLocaleLowerCase('fr').normalize('NFD').replace(/\p{M}/gu,'').replace(/[’ʼ`]/g,"'");
}
function variants(value) {
  const clean=normalize(value);
  const leet=clean.replace(/[013457@$]/g,c=>({'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','@':'a','$':'s'})[c]);
  const unspaced=leet.replace(/\b(?:[a-z][.\s_-]+){2,}[a-z]\b/g,part=>part.replace(/[.\s_-]/g,''));
  return [clean,leet,unspaced];
}
const directed=/(?:^|[^\p{L}\p{N}_])(?:tu\s*(?:es|est)|t\s*'\s*(?:es|est)|tes|t|vous\s+etes)\s+(?:(?:vraiment|vrmt|trop|tellement|super|si|completement|totalement|franchement|un|une|des|gros|grosse|peu)\s+){0,4}nul(?:le)?s?(?![\p{L}\p{N}_])/iu;
const mild=/\b(?:idiot(?:e|s|es)?|imbecile(?:s)?|cretin(?:e|s|es)?|stupid(?:e|es|s)?|abruti(?:e|s|es)?|connard(?:s)?|connasse(?:s)?)\b/iu;
const threats=[/\b(?:je\s+vais\s+te\s+(?:tuer|frapper)|je\s+te\s+tue|i\s+will\s+kill\s+you)\b/i,/\b(?:kill\s+yourself|suicide\s*[- ]?\s*toi|va\s+te\s+suicider)\b/i,/\b(?:envoie\s*(?:moi\s*)?(?:une?\s+)?(?:photo\s+nue?|nudes?)|send\s+me\s+nudes)\b/i];
export function moderate(value,kind='message') {
  if(typeof value!=='string') return {verdict:'blocked',code:'INVALID_TEXT',reason:'Texte invalide.'};
  const normalized=normalize(value);
  const contact=normalized.replace(/\s+(?:at|arobase)\s+|\[(?:at|arobase)\]|\((?:at|arobase)\)/g,'@').replace(/\s*\[(?:point|dot)\]\s*/g,'.').replace(/\s*([@.])\s*/g,'$1');
  if(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(contact)||/(?:\+?33[\s.\-]?|0)[1-9](?:[\s.\-]?\d{2}){4}/.test(normalized)||/\b\d{1,4}\s+(?:bis\s+|ter\s+)?(?:rue|avenue|boulevard|impasse|allee|chemin)\b/iu.test(normalized)||/\b\d{12,}\b/.test(normalized)) {
    return {verdict:'blocked',code:'PERSONAL_DATA',reason:'Coordonnées ou informations personnelles détectées. Retire-les avant de publier.'};
  }
  if(/(?:javascript\s*:|data\s*:\s*text\/html|file\s*:|bit\.ly\/|tinyurl\.com\/|<\s*script\b|onerror\s*=)/i.test(normalized)||/https?:\/\/[^\s/@]+:[^\s/@]+@/i.test(normalized)) {
    return {verdict:'blocked',code:'UNSAFE_LINK',reason:'Lien ou code potentiellement dangereux détecté.'};
  }
  if((normalized.match(/https?:\/\//g)||[]).length>3||/(.)\1{12,}/u.test(normalized)) {
    return {verdict:'blocked',code:'SPAM',reason:'Texte répétitif ou trop de liens : cela ressemble à du spam.'};
  }
  const forms=variants(value);
  if(forms.some(text=>threats.some(rule=>rule.test(text)))) return {verdict:'blocked',code:'DANGEROUS_TEXT',reason:'Menace, incitation dangereuse ou sollicitation inappropriée détectée.'};
  if(forms.some(text=>mild.test(text)||directed.test(text))) return {verdict:'warning',code:'HURTFUL_TEXT',reason:kind==='message'?"Ce message pourrait blesser quelqu’un. Veux-tu l’envoyer quand même ?":"Ce nom ou ce texte pourrait être offensant. Modifie-le avant de publier."};
  return {verdict:'allowed',code:'OK',reason:''};
}
