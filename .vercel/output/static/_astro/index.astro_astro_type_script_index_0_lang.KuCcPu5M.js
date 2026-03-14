import{i as L,a as I,b as T}from"./scroll-reveal.BOYGXWIK.js";function k(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}function d(e,...t){let s="";e.forEach((a,o)=>{s+=a+(t[o]??"")});const n=s.split(`
`);n[0].trim()===""&&n.shift(),n[n.length-1]?.trim()===""&&n.pop();let r=1/0;for(const a of n){if(a.trim()==="")continue;const o=a.match(/^( *)/);o&&o[1].length<r&&(r=o[1].length)}return r===1/0&&(r=0),n.map(a=>a.slice(r))}const A=["help","status","about","services","explore consultations","explore automation","explore training","explore personal-ai","stack","contact","book","clear"],x=[...A,"explore","ping","sudo","whoami","cowsay","matrix","exit","ls","cat","rm","cd","npm","hello","hi","42"],S={help:{description:"list available commands",run:()=>d`
    <span class="t-muted">available commands:</span>

      <span class="t-green">help</span>              show this message
      <span class="t-green">status</span>            system status readout
      <span class="t-green">about</span>             founder info
      <span class="t-green">services</span>          list all services
      <span class="t-green">explore</span> <span class="t-muted">service</span>   chat with AI about a service
      <span class="t-green">stack</span>             tech stack
      <span class="t-green">contact</span>           get in touch
      <span class="t-green">book</span>              book a free audit call
      <span class="t-green">clear</span>             clear terminal

    <span class="t-muted">tab to autocomplete · ↑↓ history · try hidden commands</span>
    `},status:{description:"system status",run:()=>d`
    <span class="t-muted">&gt; checking systems...</span> <span class="t-green">✓</span>

    <span class="t-muted">  founder:</span>        Charlie Waite
    <span class="t-muted">  location:</span>        London, UK
    <span class="t-muted">  status:</span>          <span class="t-green">[● ACTIVE]</span>
    <span class="t-muted">  specialty:</span>       AI systems + automation
    <span class="t-muted">  clients served:</span>  40+
    <span class="t-muted">  current load:</span>    accepting new clients

    <span class="t-pink">→ run "book" to get started</span>
    `},about:{description:"founder info",run:()=>d`
    <span class="t-green">Charlie Waite</span> · Founder, Camber Co

    12 years building software.
    Using AI in production since 2023.
    Based in London, UK.

    I work with a small number of founders at a time —
    directly, hands-on. No account managers, no juniors.
    You get me, and you get results you can point at.
    `},services:{description:"list services",run:()=>d`
    <span class="t-green">ACTIVE SERVICES</span>

    <span class="t-green">  consultations</span>   AI strategy sessions
    <span class="t-green">  automation</span>      n8n workflow engineering
    <span class="t-green">  training</span>        solo founder coaching
    <span class="t-green">  personal-ai</span>     your own AI assistant

    <span class="t-muted">run "explore &lt;service&gt;" to chat with AI about it</span>
    `},explore:{description:"explore a service",run:e=>{const t=e[0]||"";return["consultations","automation","training","personal-ai"].includes(t)?(setTimeout(()=>{window.__openChatDrawer&&window.__openChatDrawer(t)},100),['<span class="t-green">opening chat...</span>']):['<span class="t-muted">usage:</span> explore <span class="t-green">consultations</span> | <span class="t-green">automation</span> | <span class="t-green">training</span> | <span class="t-green">personal-ai</span>']}},stack:{description:"tech stack",run:()=>d`
    <span class="t-green">CAMBER CO STACK</span>

    <span class="t-muted">  automation:</span>  n8n, Make, Zapier
    <span class="t-muted">  ai/ml:</span>       OpenAI, Anthropic, local LLMs
    <span class="t-muted">  platforms:</span>   WhatsApp, Slack, Discord, Telegram
    <span class="t-muted">  infra:</span>       Vercel, Supabase, Cloudflare
    <span class="t-muted">  frontend:</span>    Astro, vanilla JS
    <span class="t-muted">  languages:</span>   TypeScript, Python

    <span class="t-muted">"use the right tool, not the shiny one"</span>
    `},contact:{description:"contact info",run:()=>d`
    <span class="t-green">GET IN TOUCH</span>

    <span class="t-muted">  email:</span>     hello@camberco.uk
    <span class="t-muted">  calendar:</span>  calendly.com/camber-co/30min
    <span class="t-muted">  web:</span>       camberco.uk

    <span class="t-pink">→ free 30-min audit — no commitment</span>
    `},book:{description:"book an audit call",run:()=>(window.open("https://calendly.com/camber-co/30min","_blank"),d`
      <span class="t-green">opening booking page...</span>

      → calendly.com/camber-co/30min
        30-minute free audit call
        no commitment required

      <span class="t-muted">if the page didn't open, visit the link above</span>
      `)},clear:{description:"clear terminal",run:()=>[]},ping:{description:"",run:()=>['<span class="t-green">pong</span> <span class="t-muted">(12ms from London)</span>']},sudo:{description:"",run:()=>[`<span class="t-pink">nice try.</span> <span class="t-muted">this isn't that kind of terminal.</span>`]},whoami:{description:"",run:()=>[`a founder who's about to save a lot of time <span class="t-green">✓</span>`]},42:{description:"",run:()=>["the answer to life, the universe, and automation."]},cowsay:{description:"",run:()=>[" __________________________","&lt; automate everything.    &gt;"," --------------------------","        \\   ^__^","         \\  (oo)\\_______","            (__)\\       )\\/\\","                ||----w |","                ||     ||"]},matrix:{description:"",run:()=>d`
    <span class="t-green">wake up, founder...</span>
    <span class="t-green">the AI is here.</span>
    <span class="t-green">follow the white rabbit.</span>

    <span class="t-muted">...or just type "book"</span>
    `},exit:{description:"",run:()=>['<span class="t-muted">there is no escape. only automation.</span>']},ls:{description:"",run:()=>['<span class="t-green">automations/</span>  <span class="t-green">clients/</span>  <span class="t-green">ai-tools/</span>  README.md  .env <span class="t-muted">(nice try)</span>']},cat:{description:"",run:e=>[e[0]===".env"?'<span class="t-pink">ACCESS DENIED</span> <span class="t-muted">— secrets stay secret</span>':`<span class="t-muted">cat: ${k(e[0]||"meow")}: permission denied</span>`]},rm:{description:"",run:()=>['<span class="t-pink">absolutely not.</span>']},cd:{description:"",run:()=>[`<span class="t-muted">you're already where you need to be.</span>`]},npm:{description:"",run:()=>['<span class="t-muted">we use pnpm here.</span> <span class="t-green">standards matter.</span>']},hello:{description:"",run:()=>['<span class="t-green">hey!</span> type <span class="t-pink">help</span> to see what I can do.']},hi:{description:"",run:()=>['<span class="t-green">hey!</span> type <span class="t-pink">help</span> to see what I can do.']}};function M(e){const t=e.trim();if(!t)return[];const s=t.split(/\s+/),n=s[0].toLowerCase(),r=s.slice(1),a=S[n];return a?a.run(r):[`<span class="t-muted">command not found: ${k(n)}. type "help" for available commands.</span>`]}function y(e){if(!e)return null;const t=e.toLowerCase();return x.find(n=>n.startsWith(t)&&n!==t)??null}async function D(e,t,s=8){const n=window.matchMedia("(prefers-reduced-motion: reduce)").matches;for(const r of t){const a=document.createElement("div");a.className="tl",e.appendChild(a),n||s<=0?a.innerHTML=r||"&nbsp;":(a.innerHTML=r||"&nbsp;",a.classList.add("tl-fadein"),await new Promise(o=>setTimeout(o,s))),e.scrollTop=e.scrollHeight}}async function B(e,t,s=!0){const n=document.createElement("div");n.className="tl tl-cmd";const r=document.createElement("span");r.className="t-prompt",r.textContent="$ ";const a=document.createElement("span");a.textContent=t,n.appendChild(r),n.appendChild(a),e.appendChild(n),e.scrollTop=e.scrollHeight;const o=M(t);if(o.length>0){const p=document.createElement("div");p.className="tl-block",e.appendChild(p),await D(p,o,s?12:0)}const l=document.createElement("div");l.className="tl-spacer",e.appendChild(l),e.scrollTop=e.scrollHeight}async function H(e){const t=window.matchMedia("(prefers-reduced-motion: reduce)").matches,s=r=>t?Promise.resolve():new Promise(a=>setTimeout(a,r)),n=['<span class="t-muted">camber-os v2.0.0</span>','<span class="t-muted">connecting to London node...</span> <span class="t-green">connected</span>','<span class="t-muted">loading services...</span> <span class="t-green">4 active</span>',"",'<span class="t-green">system ready.</span> type <span class="t-pink">help</span> to begin.',""];for(const r of n){const a=document.createElement("div");a.className="tl tl-boot",a.innerHTML=r||"&nbsp;",e.appendChild(a),e.scrollTop=e.scrollHeight,await s(r===""?80:180)}}function N(){const e=document.getElementById("interactiveTerminal"),t=document.getElementById("terminalOutput"),s=document.getElementById("terminalInput"),n=document.getElementById("terminalGhost");if(!e||!t||!s||!n)return;const r=[];let a=-1,o=!1,l=!1;function p(){const c=s.value,i=y(c);i&&c.length>0?(n.textContent=i,n.style.display=""):(n.textContent="",n.style.display="none")}s.addEventListener("input",p),s.addEventListener("keydown",async c=>{if(c.key==="Tab"){c.preventDefault();const i=y(s.value);i&&(s.value=i,p());return}if(c.key==="Enter"){if(l)return;const i=s.value.trim();if(!i)return;l=!0,r.push(i),a=r.length,s.value="",n.textContent="",n.style.display="none",i.toLowerCase()==="clear"?t.innerHTML="":await B(t,i,!0),l=!1,s.focus();return}if(c.key==="ArrowUp"){c.preventDefault(),a>0&&(a--,s.value=r[a],p());return}if(c.key==="ArrowDown"){c.preventDefault(),a<r.length-1?(a++,s.value=r[a]):(a=r.length,s.value=""),p();return}}),e.addEventListener("click",()=>{l||s.focus()});const f=new IntersectionObserver(async c=>{for(const i of c)!i.isIntersecting||o||(o=!0,f.unobserve(e),l=!0,await H(t),l=!1,s.placeholder="",n.textContent="help",n.style.display="")},{threshold:.3});f.observe(e)}function O(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function C(e){return O(e).replace(/(https?:\/\/[^\s)&]+)/g,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')}let _="general",m=[],u=!1;function g(){return{drawer:document.getElementById("chatDrawer"),backdrop:document.getElementById("chatBackdrop"),messagesEl:document.getElementById("chatMessages"),input:document.getElementById("chatInput"),closeBtn:document.getElementById("chatClose"),sendBtn:document.getElementById("chatSend"),title:document.getElementById("chatTitle")}}function P(e,t,s){const n=document.createElement("div");return n.className="chat-msg chat-msg--user",n.innerHTML=C(s),e.appendChild(n),e.scrollTop=e.scrollHeight,n}async function E(e){u=!0;const t=document.createElement("div");t.className="chat-msg chat-msg--bot chat-msg--streaming",t.textContent="...",e.appendChild(t),e.scrollTop=e.scrollHeight;try{const s=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({service:_,messages:m})});if(!s.ok){const o=await s.json().catch(()=>({error:"Something went wrong."}));t.classList.remove("chat-msg--streaming"),t.textContent=o.error||"Something went wrong. Please try again.",u=!1;return}const n=s.body?.getReader();if(!n){t.textContent="Connection error. Please try again.",t.classList.remove("chat-msg--streaming"),u=!1;return}const r=new TextDecoder;let a="";for(t.textContent="";;){const{done:o,value:l}=await n.read();if(o)break;const p=r.decode(l,{stream:!0});a+=p,t.innerHTML=C(a),e.scrollTop=e.scrollHeight}t.classList.remove("chat-msg--streaming"),m.push({role:"assistant",content:a})}catch{t.classList.remove("chat-msg--streaming"),t.innerHTML='connection lost. <a href="https://calendly.com/camber-co/30min" target="_blank" rel="noopener noreferrer">book a call directly</a>'}u=!1}function R(e="general"){const t=g();if(!t.drawer||!t.backdrop||!t.messagesEl||!t.input||!t.title)return;_=e,m=[],t.messagesEl.innerHTML="";const s={consultations:"camber/ai — consultations",automation:"camber/ai — automation",training:"camber/ai — training","personal-ai":"camber/ai — personal ai",general:"camber/ai"};t.title.textContent=s[e]||"camber/ai",t.drawer.setAttribute("aria-hidden","false"),t.backdrop.setAttribute("aria-hidden","false"),document.body.style.overflow="hidden",setTimeout(()=>t.input?.focus(),350),E(t.messagesEl)}function h(){const e=g();!e.drawer||!e.backdrop||(e.drawer.setAttribute("aria-hidden","true"),e.backdrop.setAttribute("aria-hidden","true"),document.body.style.overflow="")}function w(){const e=g();if(!e.input||!e.messagesEl||u)return;const t=e.input.value.trim();t&&(e.input.value="",m.push({role:"user",content:t}),P(e.messagesEl,"user",t),E(e.messagesEl))}function $(){const e=g();e.drawer&&(e.closeBtn?.addEventListener("click",h),e.backdrop?.addEventListener("click",h),document.addEventListener("keydown",t=>{t.key==="Escape"&&h()}),e.sendBtn?.addEventListener("click",w),e.input?.addEventListener("keydown",t=>{t.key==="Enter"&&!u&&(t.preventDefault(),w())}),window.__openChatDrawer=R)}L();I();T();N();$();document.querySelectorAll("[data-chat-open]").forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.chatOpen;t&&window.__openChatDrawer&&window.__openChatDrawer(t)})});document.querySelectorAll('a[href^="#"]').forEach(e=>{e.addEventListener("click",t=>{const s=e.getAttribute("href");if(!s)return;const n=document.querySelector(s);if(n){t.preventDefault();const a=n.getBoundingClientRect().top+window.scrollY-80;window.scrollTo({top:a,behavior:"smooth"})}})});const v=document.getElementById("scrollIndicator");let b=!1;v&&window.addEventListener("scroll",()=>{!b&&window.scrollY>60&&(b=!0,v.classList.add("hidden"))},{passive:!0});
