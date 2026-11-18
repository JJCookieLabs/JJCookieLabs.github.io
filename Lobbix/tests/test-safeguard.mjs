import assert from 'node:assert/strict';
import {moderate,VERSION} from '../server/moderation.js';
let passed=0;
for(const text of ['bonjour','Bonsoir tout le monde','Un résultat nul','Tu n’es pas nul','On joue au morpion ?','2 + 3 = 5','Maths : 11 / 2','Le 17/11/2026','C’est stupéfiant','Une photo du paysage','Je suis disponible à 18h30']){
 assert.equal(moderate(text).verdict,'allowed',text);passed++;
}
for(const text of ['tu est nul','tu es nulle','t’es vraiment nul','vous êtes nuls','idiot','1d10t','i.d.i.o.t','abruti','CONNARD','tu es n\u200bul']){
 assert.equal(moderate(text).verdict,'warning',text);passed++;
}
for(const text of ['mon adresse est test@example.com','test @ exemple . fr','appelez le 06 12 34 56 78','+33 6 12 34 56 78','12 rue des Lilas','123456789012345','je vais te tuer','je vais te fr4pper','kill yourself','envoie moi une photo nue','javascript:alert(1)','data:text/html,<script>alert(1)</script>','https://bit.ly/abc','https://a:password@example.com/','aaaaaaaaaaaaaa','https://a.fr https://b.fr https://c.fr https://d.fr']){
 assert.equal(moderate(text).verdict,'blocked',text);passed++;
}
assert.equal(VERSION,'2.0.0');passed++;
console.log(JSON.stringify({safeguard_checks:passed,production_requests:0}));
