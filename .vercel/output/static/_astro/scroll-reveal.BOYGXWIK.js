const x=`.typewriter-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-green-500, #22c55e);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: cursor-blink 1.06s step-end infinite;
}
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .typewriter-cursor { animation: none; opacity: 1; }
}
`;function g(){return typeof window<"u"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}function y(a){const r=document.createElement("span");return r.className="typewriter-cursor",r.setAttribute("aria-hidden","true"),a!==530&&(r.style.animationDuration=`${a}ms`),r}function b(a,r,s,o){return new Promise(n=>{a.appendChild(s);let t=0;function e(){if(t>=r.length){n();return}const i=document.createTextNode(r[t]);a.insertBefore(i,s),t++,setTimeout(e,o)}setTimeout(e,o)})}function w(a,r,s={}){const{speed:o=40,startDelay:n=0,cursorBlinkRate:t=530,onComplete:e}=s;if(a.setAttribute("aria-label",r.join(" ")),a.setAttribute("aria-live","polite"),g()){r.forEach(l=>{const u=document.createElement("div");u.textContent=l,a.appendChild(u)}),e?.();return}const i=y(t),c=300;async function d(){for(let l=0;l<r.length;l++){const u=document.createElement("div");a.appendChild(u),await b(u,r[l],i,o),l<r.length-1&&await new Promise(f=>setTimeout(f,c))}e?.()}n>0?setTimeout(d,n):d()}function A(){document.querySelectorAll("[data-typewriter]").forEach(r=>{let s=[];const o=r.dataset.lines;if(o)try{const c=JSON.parse(o);Array.isArray(c)&&(s=c.map(String))}catch{console.warn("[typewriter] Invalid JSON in data-lines:",o)}if(s.length===0&&r.textContent?.trim()&&(s=[r.textContent.trim()],r.textContent=""),s.length===0)return;const n={},t=r.dataset.speed;t!==void 0&&(n.speed=Number(t));const e=r.dataset.startDelay;e!==void 0&&(n.startDelay=Number(e));const i=r.dataset.cursorBlink;i!==void 0&&(n.cursorBlinkRate=Number(i)),w(r,s,n)})}const S=`[data-reveal], [data-reveal-stagger] > * {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 400ms cubic-bezier(0.16, 1, 0.3, 1),
              transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal-visible, [data-reveal-stagger].revealed > * {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal], [data-reveal-stagger] > * {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
`;function p(){return typeof window<"u"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches}function C(){const a=Array.from(document.querySelectorAll("[data-reveal]")),r=Array.from(document.querySelectorAll("[data-reveal-stagger]"));if(p()){a.forEach(n=>n.classList.add("reveal-visible")),r.forEach(n=>{Array.from(n.children).forEach(e=>e.classList.add("reveal-visible")),n.classList.add("revealed")});return}a.forEach(n=>n.classList.add("reveal-hidden"));const s=80,o=new IntersectionObserver(n=>{n.forEach(t=>{if(!t.isIntersecting)return;const e=t.target;if(e.hasAttribute("data-reveal")){e.classList.remove("reveal-hidden"),e.classList.add("reveal-visible"),o.unobserve(e);return}e.hasAttribute("data-reveal-stagger")&&(Array.from(e.children).forEach((c,d)=>{c.style.transitionDelay=`${d*s}ms`,c.offsetHeight,c.classList.add("reveal-visible")}),e.classList.add("revealed"),o.unobserve(e))})},{threshold:.2});a.forEach(n=>o.observe(n)),r.forEach(n=>o.observe(n))}function T(){const r=Array.from(document.querySelectorAll("[data-count-to]"));if(r.length===0)return;function s(t){return 1-Math.pow(1-t,4)}function o(t){const e=parseFloat(t.dataset.countTo??"0"),i=t.dataset.countSuffix??"",d=!Number.isInteger(e)?t.dataset.countTo?.split(".")[1]?.length??1:0;if(p()){t.textContent=e.toFixed(d)+i;return}const l=performance.now();function u(f){const h=f-l,m=Math.min(h/800,1),v=s(m)*e;t.textContent=v.toFixed(d)+i,m<1?requestAnimationFrame(u):t.textContent=e.toFixed(d)+i}requestAnimationFrame(u)}const n=new IntersectionObserver(t=>{t.forEach(e=>{e.isIntersecting&&(o(e.target),n.unobserve(e.target))})},{threshold:.5});r.forEach(t=>{const e=t.dataset.countSuffix??"",i=parseFloat(t.dataset.countTo??"0"),d=!Number.isInteger(i)?t.dataset.countTo?.split(".")[1]?.length??1:0;t.textContent=0 .toFixed(d)+e,n.observe(t)})}export{S,x as T,C as a,T as b,A as i};
