// Hide the WebGL scene canvas when the user scrolls past the hero
// → No more orange particles or purple wireframes bleeding into light sections
(function(){
  const install = () => {
    const canvas = document.getElementById('scene-canvas');
    const hero = document.getElementById('hero');
    if(!canvas || !hero) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        canvas.style.display = e.isIntersecting ? 'block' : 'none';
      });
    }, { threshold: 0.1 });
    io.observe(hero);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();

/* ═══════════════════════════════════════ */

// Quiet reveal - content is gated hidden until the DOM is ready, then shown.
// No decorative intro overlay (removed in the editorial rebuild).
(function(){
  const reveal = () => document.body.classList.add("intro-done");
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reveal);
  } else {
    reveal();
  }
})();

/* ═══════════════════════════════════════ */

// (scene silencing handled via CSS mask on #scene-canvas past hero)

/* ═══════════════════════════════════════ */

// ============================================================
// THREE.JS 3D ORBS (Enzo Casalini style)
// ============================================================
(function initOrbs(){
  if(typeof THREE === 'undefined') return;

  // Scroll reactivity (Enzo-style): eased 0..1 driven by page scroll.
  let scrollTarget = 0;
  window.addEventListener('scroll', () => {
    scrollTarget = Math.min(1, window.scrollY / (window.innerHeight * 0.9));
  }, { passive: true });

  function createOrbScene(canvas, size){
    const renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 2.8;

    // Sphere geometry
    const geo = new THREE.SphereGeometry(1, 64, 64);

    // Custom shader material - the Enzo-style glowing 3D orb
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:      { value: 0 },
        uColor1:    { value: new THREE.Color('#FFB37A') },
        uColor2:    { value: new THREE.Color('#FF7A1A') },
        uColor3:    { value: new THREE.Color('#071022') },
        uFresnelPow:{ value: 2.5 },
        uGlowStr:   { value: 0.85 },
        uNoiseSeed: { value: Math.random() * 10 },
        uScroll:    { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uNoiseSeed;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        // Simple noise
        float hash(vec3 p){
          p = fract(p * vec3(443.8975,397.2973,491.1871));
          p += dot(p.zxy, p.yxz + 19.19);
          return fract(p.x * p.y * p.z);
        }
        float noise(vec3 p){
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(
            mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),
            f.z);
        }

        void main(){
          vNormal   = normalize(normalMatrix * normal);
          vUv       = uv;
          vPosition = position;

          // Subtle surface displacement
          float n = noise(position * 2.2 + uTime * 0.25 + uNoiseSeed);
          vec3 displaced = position + normal * n * 0.045;

          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3  uColor1;
        uniform vec3  uColor2;
        uniform vec3  uColor3;
        uniform float uFresnelPow;
        uniform float uGlowStr;
        uniform float uScroll;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        float fhash(vec3 p){
          p = fract(p * vec3(443.8975,397.2973,491.1871));
          p += dot(p.zxy, p.yxz + 19.19);
          return fract(p.x * p.y * p.z);
        }
        float fnoise(vec3 p){
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(
            mix(mix(fhash(i),fhash(i+vec3(1,0,0)),f.x),mix(fhash(i+vec3(0,1,0)),fhash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(fhash(i+vec3(0,0,1)),fhash(i+vec3(1,0,1)),f.x),mix(fhash(i+vec3(0,1,1)),fhash(i+vec3(1,1,1)),f.x),f.y),
            f.z);
        }
        float fbm(vec3 p){
          float v = 0.0; float a = 0.5;
          for(int i = 0; i < 4; i++){ v += a * fnoise(p); p *= 2.0; a *= 0.5; }
          return v;
        }

        void main(){
          // Fresnel rim
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), uFresnelPow);

          // Color blend top to bottom
          float blend = vPosition.y * 0.5 + 0.5;
          vec3 baseColor = mix(uColor3, mix(uColor2, uColor1, blend), blend);

          // Electric plasma filaments - animated, intensify with scroll
          float t = uTime * (0.35 + uScroll * 0.7);
          float veins = fbm(vPosition * 3.2 + vec3(t, t * 0.7, -t * 0.5));
          veins = abs(veins * 2.0 - 1.0);            // fold into ridged veins
          float filament = pow(1.0 - veins, 4.0);     // sharp bright lines
          filament *= 0.55 + uScroll * 1.05;          // stronger as you scroll
          vec3 sparkCol = mix(uColor1, vec3(1.0, 0.88, 0.94), 0.6);

          // Specular highlight
          vec3 lightDir = normalize(vec3(0.4, 0.6, 1.0));
          float spec = pow(max(dot(reflect(-lightDir, vNormal), viewDir), 0.0), 32.0);
          vec3 specColor = vec3(1.0, 0.75, 0.75) * spec * 0.6;

          // Combine
          vec3 col = baseColor + specColor + sparkCol * filament;
          col = mix(col, uColor1, fresnel * uGlowStr);

          // Pulsing brightness (a touch brighter while scrolling)
          float pulse = sin(uTime * 1.4) * 0.06 + 0.97;
          col *= pulse * (1.0 + uScroll * 0.18);

          // Alpha: full sphere + soft edge glow
          float alpha = 0.92 + fresnel * 0.08;

          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      side: THREE.FrontSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // Outer glow ring
    const glowGeo  = new THREE.SphereGeometry(1.12, 32, 32);
    const glowMat  = new THREE.ShaderMaterial({
      uniforms: { uTime: mat.uniforms.uTime, uColor: { value: new THREE.Color('#FF7A1A') } },
      vertexShader: `varying vec3 vNormal; void main(){ vNormal=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; uniform float uTime; varying vec3 vNormal;
        void main(){
          vec3 vd = normalize(cameraPosition - vec3(0));
          float f = pow(1.0 - max(dot(vNormal,vd),0.0), 3.5);
          float pulse = sin(uTime*1.4)*0.15+0.85;
          gl_FragColor = vec4(uColor, f*0.45*pulse);
        }`,
      transparent: true,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(glowGeo, glowMat));

    let mouse = { x: 0, y: 0 };
    canvas.parentElement.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width  - 0.5) * 2;
      mouse.y = ((e.clientY - r.top)  / r.height - 0.5) * 2;
    });

    let frame = 0;
    function animate(){
      requestAnimationFrame(animate);
      frame++;
      mat.uniforms.uTime.value += 0.016;
      glowMat.uniforms.uTime.value = mat.uniforms.uTime.value;
      // Ease orb energy toward scroll position (Enzo-style reactivity)
      mat.uniforms.uScroll.value += (scrollTarget - mat.uniforms.uScroll.value) * 0.06;
      // Gentle mouse-follow rotation
      mesh.rotation.y += (mouse.x * 0.4 - mesh.rotation.y) * 0.05;
      mesh.rotation.x += (-mouse.y * 0.2 - mesh.rotation.x) * 0.05;
      // Continuous slow drift, faster as you scroll
      mesh.rotation.y += 0.003 + mat.uniforms.uScroll.value * 0.012;
      renderer.render(scene, camera);
    }
    animate();

    return { renderer, mat };
  }

  // Wait for DOM to be ready (orbs may not exist yet during intro phase)
  function tryInit(){
    const introCanvas   = document.getElementById('canvas-intro');
    const heroCanvas    = document.getElementById('canvas-hero');
    const launchCanvas  = document.getElementById('canvas-launcher');

    if(introCanvas){
      const sz = introCanvas.parentElement.offsetWidth || 220;
      introCanvas.width  = sz;
      introCanvas.height = sz;
      createOrbScene(introCanvas, sz);
    }
    if(heroCanvas){
      const sz = heroCanvas.parentElement.offsetWidth || 300;
      heroCanvas.width  = sz;
      heroCanvas.height = sz;
      createOrbScene(heroCanvas, sz);
    }
    if(launchCanvas){
      launchCanvas.width  = 40;
      launchCanvas.height = 40;
      createOrbScene(launchCanvas, 40);
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    setTimeout(tryInit, 100);
  }
})();

// ============================================================
// HORIZONTAL SCROLL PROJECTS (Luke Baffait style)
// ============================================================
(function initProjects(){
  function setup(){
    const track = document.getElementById('proj-track');
    if(!track) return;

    const cards  = Array.from(track.querySelectorAll('.proj-card'));
    const progEl = document.getElementById('proj-progress');

    // Build progress dots
    cards.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.className = 'proj-progress-dot' + (i === 0 ? ' active' : '');
      progEl.appendChild(dot);
    });

    // Mark center card active on scroll
    function updateActive(){
      const trackRect  = track.getBoundingClientRect();
      const trackCx    = trackRect.left + trackRect.width / 2;
      let closestIdx = 0;
      let closestDist = Infinity;

      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const dist = Math.abs(cx - trackCx);
        if(dist < closestDist){ closestDist = dist; closestIdx = i; }
        // Tilt based on distance from center
        const offset = cx - trackCx;
        const maxTilt = 3.5;
        const tilt = Math.max(-maxTilt, Math.min(maxTilt, offset / trackRect.width * 12));
        const scale = 1 - Math.min(Math.abs(offset) / (trackRect.width * 0.8), 0.08);
        const opacity = 0.55 + (1 - Math.min(Math.abs(offset) / (trackRect.width * 0.55), 1)) * 0.45;
        card.style.transform = `rotate(${tilt}deg) scale(${scale})`;
        card.style.opacity   = opacity;
      });

      // Mark active card
      cards.forEach((c,i) => c.classList.toggle('active', i === closestIdx));
      progEl.querySelectorAll('.proj-progress-dot').forEach((d,i) => d.classList.toggle('active', i===closestIdx));
    }

    track.addEventListener('scroll', updateActive, { passive: true });

    // Mouse drag-to-scroll (desktop)
    let isDown = false, startX = 0, scrollLeft = 0, velX = 0, lastX = 0;
    track.addEventListener('mousedown', e => {
      isDown = true;
      startX = e.pageX - track.offsetLeft;
      scrollLeft = track.scrollLeft;
      velX = 0; lastX = e.pageX;
      track.style.cursor = 'grabbing';
    });
    track.addEventListener('mouseleave', () => { isDown = false; track.style.cursor = 'grab'; });
    track.addEventListener('mouseup', () => { isDown = false; track.style.cursor = 'grab'; });
    track.addEventListener('mousemove', e => {
      if(!isDown) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      velX = e.pageX - lastX;
      lastX = e.pageX;
      track.scrollLeft = scrollLeft - (x - startX) * 1.6;
    });

    // Touch drag - native scrolling handles it, just update dots
    track.addEventListener('touchstart', e => {}, { passive: true });
    track.addEventListener('touchend',   () => { setTimeout(updateActive, 80); }, { passive: true });

    // Keyboard navigation (accessibility)
    track.setAttribute('tabindex','0');
    track.addEventListener('keydown', e => {
      if(e.key==='ArrowRight') track.scrollLeft += 200;
      if(e.key==='ArrowLeft')  track.scrollLeft -= 200;
    });

    // Initial snap to first card
    setTimeout(() => {
      track.scrollLeft = 0;
      updateActive();
    }, 100);

    // Wheel scroll left as native - no preventDefault so page scrolls freely

    // GSAP entrance: cards fan in from below when section scrolls into view
    const section = document.getElementById('projects');
    if(!section) return;
    const io = new IntersectionObserver(entries => {
      if(entries[0].isIntersecting){
        if(typeof gsap !== 'undefined'){
          gsap.from(cards, {
            y: 80,
            rotation: (i) => i%2===0 ? -6 : 6,
            opacity: 0,
            duration: 0.9,
            ease: 'power4.out',
            stagger: 0.1,
            delay: 0.1,
            onComplete: updateActive
          });
        } else { updateActive(); }
        io.unobserve(section);
      }
    }, { threshold: 0.15 });
    io.observe(section);
  }

  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', setup); }
  else { setTimeout(setup, 200); }
})();

/* ═══════════════════════════════════════ */

(function(){


  // ============ NAV SCROLL STATE ============
  (function(){
    const nav = document.getElementById('main-nav');
    if(!nav) return;
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });
  })();

  // ============ HAMBURGER NAV ============
  (function(){
    const hamburger = document.getElementById('nav-hamburger');
    const drawer    = document.getElementById('nav-drawer');
    if(!hamburger || !drawer) return;
    hamburger.addEventListener('click', () => {
      const open = drawer.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // Close on link click
    drawer.querySelectorAll('.drawer-link').forEach(link => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
        hamburger.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
    // Drawer beru btn
    const drawerBeru = document.getElementById('drawer-beru-btn');
    if(drawerBeru) drawerBeru.addEventListener('click', e => {
      e.preventDefault();
      drawer.classList.remove('open');
      hamburger.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(() => document.getElementById('beru-launcher')?.click(), 200);
    });
  })();

  // ============ PHOTO PARALLAX TILT ============
  (function(){
    const wrap  = document.getElementById('photo-tilt');
    const photo = document.getElementById('photo-wrap');
    if(!wrap) return;

    // Scroll reveal
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if(en.isIntersecting){
          wrap.classList.add('revealed');
          // Also animate the tag
          const tag = photo ? photo.querySelector('.about-photo-tag') : null;
          if(tag){ tag.style.opacity='1'; tag.style.transform='translateY(0)'; }
          revealObserver.unobserve(wrap);
        }
      });
    }, { threshold: 0.2 });
    revealObserver.observe(wrap);

    // Parallax tilt on mousemove
    const frame = wrap.querySelector('.photo-frame');
    if(!frame) return;
    let rafId = null;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;

    frame.addEventListener('mousemove', e => {
      const r = frame.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      targetX = y * -12;   // tilt X (up/down)
      targetY = x *  12;   // tilt Y (left/right)
    });
    frame.addEventListener('mouseleave', () => {
      targetX = 0; targetY = 0;
    });

    function animTilt(){
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      wrap.style.transform = `perspective(800px) rotateX(${currentX}deg) rotateY(${currentY}deg)`;
      rafId = requestAnimationFrame(animTilt);
    }
    animTilt();
  })();


  // ============ WEB AUDIO TYPING SOUND ============
  let audioCtx = null;
  function playClick(){
    try {
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const b = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.04, audioCtx.sampleRate);
      const d = b.getChannelData(0);
      for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(audioCtx.sampleRate*0.008));
      const s = audioCtx.createBufferSource();
      s.buffer = b;
      const g = audioCtx.createGain();
      g.gain.value = 0.06;
      s.connect(g);
      g.connect(audioCtx.destination);
      s.start();
    } catch(e){}
  }

  // ============ BERU INTRO ============
  const intro = document.getElementById('beru-intro');
  const introOrb = document.getElementById('beru-intro-orb');
  const typeout = document.getElementById('beru-typeout');
  const caret = document.getElementById('beru-caret');

  const launcher = document.getElementById('beru-launcher');
  const panel = document.getElementById('beru-panel');

  const INTRO_MSG = "Hi, I'm B.E.R.U \u2014 Varun's personal AI assistant. Ask me anything about him.";
  let introTyped = false;

  function dismissIntro(){
    if(introTyped) return;
    introTyped = true;
    intro.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    intro.style.opacity = '0';
    intro.style.transform = 'scale(0.97)';
    setTimeout(() => {
      intro.style.display = 'none';
      revealPortfolio();
    }, 700);
  }

  function typeIntroMessage(){
    let i = 0;
    const speed = 38;
    function next(){
      if(i < INTRO_MSG.length){
        if(i % 2 === 0) playClick();
        typeout.textContent = INTRO_MSG.slice(0, i+1);
        i++;
        setTimeout(next, speed + (Math.random()*20-10));
      } else {
        caret.style.display = 'none';
        setTimeout(dismissIntro, 2200);
      }
    }
    setTimeout(next, 600);
  }

  introOrb.addEventListener('click', () => {
    dismissIntro();
    setTimeout(() => {
      launcher.classList.remove('hidden');
      document.getElementById('beru-launcher').click();
    }, 800);
  });
  introOrb.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') introOrb.click(); });


  // Start typing after short delay
  setTimeout(typeIntroMessage, 700);

  // ============ REVEAL PORTFOLIO (GSAP) ============
  function revealPortfolio(){
    launcher.classList.remove('hidden');
    const nav = document.getElementById('main-nav');
    const hero = document.getElementById('hero');
    const marqueeEl = document.getElementById('marquee-el');

    // Nav
    gsap.to(nav, { opacity:1, y:0, duration:0.7, ease:'power3.out', delay:0.1 });

    // Hero eyebrow
    gsap.from('.hero-eyebrow span', { y:'110%', opacity:0, duration:0.8, ease:'power4.out', delay:0.25 });

    // Hero name - reveal with stagger
    const heroName = document.getElementById('hero-name');
    if(heroName){
      setTimeout(() => heroName.classList.add('revealed'), 150);
    }

    // Hero headline words
    const words = document.querySelectorAll('.word-inner');
    gsap.from(words, { y:'115%', opacity:0, duration:0.9, ease:'power4.out', stagger:0.07, delay:0.35 });

    // Hero sub + ctas
    gsap.from('.hero-sub', { y:24, opacity:0, duration:0.8, ease:'power3.out', delay:0.85 });
    gsap.fromTo('.hero-ctas .btn', { y:20, opacity:0 }, { y:0, opacity:1, duration:0.7, ease:'power3.out', stagger:0.1, delay:1.0, overwrite:'auto' });

    // Hero right orb
    gsap.from('.hero-orb-wrap', { scale:0.82, opacity:0, duration:1.1, ease:'back.out(1.6)', delay:0.55 });

    // Hero and marquee visible
    gsap.to(hero, { opacity:1, duration:0.01 });
    gsap.to(marqueeEl, { opacity:1, duration:0.8, delay:1.1 });

    // BERU launcher
    gsap.from(launcher, { y:20, opacity:0, scale:0.9, duration:0.8, ease:'back.out(1.7)', delay:1.3 });

    // Scroll-triggered sections
    document.querySelectorAll('.section').forEach((sec, i) => {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => {
          if(en.isIntersecting){
            sec.classList.add('visible');
            io.unobserve(sec);
            // Animate headings word by word
            sec.querySelectorAll('.sec-title').forEach(h => {
              // Split only TEXT nodes, not HTML tags/entities, to preserve <br> and <em>
              const wrapTextNodes = (el) => {
                Array.from(el.childNodes).forEach(node => {
                  if(node.nodeType === 3) { // text node
                    const words = node.textContent.split(/(\s+)/);
                    const frag = document.createDocumentFragment();
                    words.forEach(w => {
                      if(/\S/.test(w)){
                        const outer = document.createElement('span');
                        outer.className = 'rev-word';
                        outer.style.cssText = 'overflow:hidden;display:inline-block;vertical-align:bottom;';
                        const inner = document.createElement('span');
                        inner.className = 'rev-inner';
                        inner.style.cssText = 'display:inline-block;transform:translateY(110%);opacity:0;';
                        inner.textContent = w;
                        outer.appendChild(inner);
                        frag.appendChild(outer);
                      } else if(w) {
                        frag.appendChild(document.createTextNode(w));
                      }
                    });
                    node.replaceWith(frag);
                  } else if(node.nodeType === 1 && node.tagName !== 'BR') {
                    wrapTextNodes(node); // recurse into <em> etc
                  }
                });
              };
              wrapTextNodes(h);
              gsap.to(h.querySelectorAll('.rev-inner'), {
                y:0, opacity:1, duration:0.75, ease:'power4.out', stagger:0.06, delay:0.1
              });
            });
          }
        });
      }, { threshold: 0.12 });
      io.observe(sec);
    });
  }

  // ============ MAGNETIC BUTTONS ============
  document.querySelectorAll('.btn-magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      const x = e.clientX - r.left - r.width/2;
      const y = e.clientY - r.top - r.height/2;
      gsap.to(btn, { x: x*0.28, y: y*0.28, duration:0.5, ease:'power2.out' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x:0, y:0, duration:0.7, ease:'elastic.out(1,0.5)' });
    });
  });

  // ============ HERO ORB -> OPEN BERU ============
  const heroOrb = document.getElementById('hero-orb');
  if (heroOrb) {
    heroOrb.addEventListener('click', () => { launcher.click(); });
    heroOrb.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') heroOrb.click(); });
  }

  document.getElementById('hero-beru-btn')?.addEventListener('click', e => { e.preventDefault(); launcher.click(); });
  document.getElementById('nav-beru-btn')?.addEventListener('click', e => { e.preventDefault(); launcher.click(); });

  // ============ BERU BRAIN ============
  const NAME = 'Varun';
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const KB = [
    { k:['hello','hi ','hey','good morning','good evening','greetings'],
      r:()=>pick([`Hello there. I'm <strong>B.E.R.U</strong> - ${NAME}'s personal AI assistant. I know him well, so ask me anything about him.`,`Hi! <strong>B.E.R.U</strong> here, ${NAME}'s portfolio assistant. What would you like to know?`]) },
    { k:['who are you','what are you','about you','what is beru'],
      r:()=>`I'm <strong>B.E.R.U</strong> - ${NAME}'s AI assistant embedded in his portfolio. I can answer questions about his background, projects, skills, and how to contact him.` },
    { k:['who is varun','about varun','tell me about','introduce','background','summary'],
      r:()=>`<strong>Varun Kumar R</strong> is an <strong>MSc Data Science & AI</strong> candidate at the University of Liverpool. Engineering background from SRM Chennai (B.Tech ECE + Data Science). Five end-to-end ML projects shipped, a national conference paper, and a live AI assistant (that's me!). Targeting <strong>AI Engineer</strong> roles. Want more detail?` },
    { k:['goal','objective','looking for','career','ambition','ai engineer'],
      r:()=>`${NAME}'s primary goal is to become an <strong>AI Engineer</strong> - designing, training and deploying intelligent systems at scale. He's actively seeking opportunities in Data Science and Machine Learning.` },
    { k:['education','study','university','degree','msc','liverpool'],
      r:()=>`<ul><li><strong>MSc Data Science & AI</strong> - University of Liverpool, UK (in progress, 2026)</li><li><strong>B.Tech ECE with Data Science specialisation</strong> - SRM Institute, Chennai (2020-2024)</li></ul>` },
    { k:['skill','tech','stack','python','tensorflow','tool','know'],
      r:()=>`${NAME}'s toolkit: <ul><li><strong>Programming:</strong> Python, SQL</li><li><strong>ML/AI:</strong> TensorFlow, Scikit-learn</li><li><strong>Visualisation:</strong> Power BI, Tableau, Matplotlib</li><li><strong>Libraries:</strong> Pandas, NumPy</li></ul>` },
    { k:['project','built','portfolio','work','what has he done'],
      r:()=>`Seven end-to-end projects:<ul><li>Telecom Churn Prediction - 86% accuracy</li><li>Plant Disease Detection (CNN) - ~90% accuracy</li><li>Twitter Sentiment Analysis - 82% F1</li><li>IoT Air Quality Monitoring - ~90% accuracy (national conference)</li><li>E-commerce Segmentation - ~85% accuracy</li><li>AI Health Assistant Chatbot (Phi-1.5 + Gradio)</li><li>Prompt Engineering for AI LMs (MSc Dissertation, in progress)</li></ul>` },
    { k:['churn','telecom'], r:()=>`Telecom Customer Churn Prediction - Random Forest and XGBoost, <strong>86% accuracy</strong>. Designed to flag at-risk customers early for proactive retention.` },
    { k:['plant','disease','cnn','crop'], r:()=>`Plant Disease Detection - CNN in TensorFlow, ~<strong>90% accuracy</strong>. Classifies diseased crop leaves from images to enable early diagnosis.` },
    { k:['twitter','sentiment','nlp','tweet'], r:()=>`Twitter Sentiment Analysis - NLP on 50,000+ tweets, <strong>82% F1-score</strong>. Built for brand monitoring pipelines.` },
    { k:['iot','air quality','pollution','sensor','conference'], r:()=>`IoT-Based Air Quality Monitoring - sensor hardware + ML, ~<strong>90% accuracy</strong>. Presented at a <strong>National Conference in 2024</strong>.` },
    { k:['ecommerce','segmentation','cluster','kmeans'], r:()=>`E-commerce Customer Segmentation - K-Means and Hierarchical clustering, ~<strong>85% accuracy</strong>. Lifted retention by 15-20%.` },
    { k:['health','chatbot','gradio','phi','microsoft','health assistant'],
      r:()=>`${NAME} built an <strong>AI Health Assistant Chatbot</strong> using Microsoft Phi-1.5 via HuggingFace Transformers with a Gradio web interface. It answers general health queries with a carefully engineered system prompt that enforces fairness and impartiality - no bias based on sex, religion, caste, or nationality. Deployed end-to-end in Google Colab.` },
    { k:['dissertation','prompt engineering','prompt'], r:()=>`${NAME}'s MSc Dissertation is titled <strong>"Prompt Engineering for AI Language Models"</strong> - investigating how prompt design shapes model behaviour, chain-of-thought reasoning, and evaluation frameworks for LLMs.` },
    { k:['experience','intern','kaashiv','work history'], r:()=>`${NAME}'s industry experience: <strong>Python Intern at Kaashiv InfoTech, Chennai (2022)</strong>. Improved data-entry efficiency by 30% with automation scripts, designed ML prototypes, and collaborated with senior developers.` },
    { k:['contact','reach','email','linkedin','phone','get in touch'],
      r:()=>`All ways to reach ${NAME}:<ul><li><a href='https://mail.google.com/mail/?view=cm&fs=1&to=varunr2510@gmail.com' target='_blank'>varunr2510@gmail.com</a></li><li><a href='https://www.linkedin.com/in/varun-kumar-r-64a311325' target='_blank'>/in/varun-kumar-r</a></li><li>+44 7353 337073 (UK) / +91 93848 28989 (IN)</li></ul>` },
    { k:['hire','opportunity','available','open to work','recruiting'],
      r:()=>`Yes - ${NAME} is <strong>actively open to opportunities</strong>: AI Engineer, ML Engineer, or Data Scientist roles (internships, graduate programmes, entry-level). Best route: <a href='https://mail.google.com/mail/?view=cm&fs=1&to=varunr2510@gmail.com' target='_blank'>email him directly</a>.` },
    { k:['learning','roadmap','next','llm','rag','mlops'],
      r:()=>`${NAME} is actively building the AI Engineer stack: <strong>transformers, LLM fundamentals, RAG pipelines, vector databases</strong> (Pinecone/FAISS/Chroma), MLOps (Docker, CI/CD), FastAPI, and fine-tuning (LoRA/PEFT). Plus his dissertation on Prompt Engineering.` },
    { k:['why hire','why varun','strength','stand out','unique','good at'],
      r:()=>`Three reasons ${NAME} stands out:<ul><li><strong>End-to-end thinking</strong> - takes problems from raw data to deployed solution</li><li><strong>Cross-domain work</strong> - telecom, agriculture, social, IoT, e-commerce</li><li><strong>Engineer + scientist</strong> - ECE background gives hardware-aware systems thinking</li></ul>` },
    { k:['how good','is he good','talented','smart','skilled','capable'],
      r:()=>`Genuinely strong. Five ML projects shipped (some hitting 90%), a national conference paper, real internship impact, and an MSc in progress. He's technically grounded, hardworking, and learning fast.` },
    { k:['beru','what is beru','how does beru work'],
      r:()=>`I'm B.E.R.U - <strong>Biographical Engagement & Recruiting Unit</strong>. I'm a Flask backend on Render talking to Groq's LLaMA 3.3 70B, with a custom system prompt ${NAME} wrote. I'm his most proudly-built project, frankly.` },
    { k:['location','where','based','liverpool'],
      r:()=>`${NAME} is currently based in <strong>Liverpool, UK</strong>, studying his MSc. Indian phone stays active too.` },
    { k:['certification','course','training'],
      r:()=>`Certifications: Data Science & AI (Boston Institute of Analytics, 6 months), Python for Data Science & ML, Deep Learning with ChatGPT, plus workshops in Power BI, RPA, and Big Data.` },
    { k:['achievement','award','conference','paper'],
      r:()=>`Highlights: <strong>National Conference presentation</strong> (IoT Air Quality, 2024), Symposium Coordinator at SRM (2022), Joint Treasurer of Rotaract Club SRM Vadapalani (2021-2023).` },
    { k:['resume','cv','download'],
      r:()=>`${NAME}'s CV is available for download - there's a Download CV button in the Resume section (scroll down, or use the nav). It's a single-page PDF with everything on this portfolio.` },
    { k:['thanks','thank you','cheers','appreciate'],
      r:()=>pick([`Anytime. Ask the contact section for ${NAME}'s details whenever you're ready.`,`Happy to help. Anything else?`]) },
    { k:['bye','goodbye','see you'],
      r:()=>`Take care. ${NAME} is a message away whenever you need him.` },
    { k:['help','what can you do','commands'],
      r:()=>`Ask me about ${NAME}'s <strong>education, skills, projects, experience, certifications, learning roadmap, contact info, or why you should hire him</strong>. Or just type anything naturally.` },
    { k:['language','english','tamil'],
      r:()=>`${NAME} is fluent in <strong>English</strong> (full professional) and a <strong>native Tamil</strong> speaker.` },
    { k:['rate','rating','score','out of 10'],
      r:()=>`For an entry-level AI Engineer candidate, I'd put ${NAME} at a confident <strong>8.5/10</strong>. Strong foundations, real project record, conference exposure, and the right learning trajectory. Reserved points are for production-scale experience, which he's actively building.` },
    { k:['recommend','should i hire','worth'],
      r:()=>`Yes - confidently. He brings five deployed ML projects, a conference paper, measurable internship impact, and genuine energy at the start of a long career. <a href='https://mail.google.com/mail/?view=cm&fs=1&to=varunr2510@gmail.com' target='_blank'>Worth a conversation</a>.` },
  ];

  const FALLBACK_CHIPS = [
    ['About Varun','Tell me about Varun'],
    ['His skills','What skills does he have?'],
    ['His projects','Show me his projects'],
    ['Why hire him','Why should I hire him?'],
    ['Contact info','How can I contact him?'],
  ];

  const POSITIVE = ['good','great','excellent','best','amazing','skilled','talented','smart','capable','qualified','strong','reliable','creative','innovative','fast','dedicated','passionate','professional','team','independent','adaptable','problem','humble','friendly','genuine','potential','proactive','hardworking'];
  const NEGATIVE = ['bad','weak','poor','useless','incompetent','lazy','dumb','stupid','arrogant','sloppy'];
  const RATING_W = ['rate','rating','score','grade','out of'];

  function detectType(t){
    const s = ' '+t.toLowerCase()+' ';
    for(const w of POSITIVE) if(s.includes(w)) return 'positive';
    for(const w of NEGATIVE) if(s.includes(w)) return 'negative';
    for(const w of RATING_W) if(s.includes(w)) return 'rating';
    return 'generic';
  }

  function fallbackReply(text){
    const chips = FALLBACK_CHIPS.map(([l,q])=>`<button class="qp inline-qp" data-q="${q}">${l}</button>`).join(' ');
    const type = detectType(text);
    let body;
    if(type==='positive') body = `Yes, that's a fair description. ${NAME} is technically grounded, hardworking and genuinely curious. Five end-to-end ML projects, a conference paper, a real internship with measurable impact, and an MSc in progress. The record backs it up.`;
    else if(type==='negative') body = `I'd push back on that. Five completed ML projects, a conference paper, real internship impact, and an MSc in progress - the record doesn't support it. If there's a specific concern, I'm happy to address it directly.`;
    else if(type==='rating') body = `For an entry-level AI Engineer candidate: confident <strong>8 to 9 out of 10</strong>. Strong foundations, real project record, conference exposure, the right learning trajectory. Points reserved for production-scale experience, actively being built.`;
    else body = `${NAME} is an <strong>MSc Data Science & AI</strong> student at Liverpool with five end-to-end ML projects shipped, a national conference paper, and a live AI assistant (me). He's hardworking, systems-first, and hungry to grow.`;
    return `${body}<br><br>Want to dig deeper?<div class="inline-qp-row">${chips}</div>`;
  }

  function lookup(text){
    const raw = text.toLowerCase().trim();
    if(!raw) return null;
    const padded = ' '+raw+' ';
    for(const e of KB) for(const k of e.k) if(padded.includes(k)) return e.r();
    const stop = new Set(['the','a','an','is','are','was','of','for','to','in','on','at','and','or','but','do','does','what','who','how','where','when','why','can','his','he','she','i','me','my','your','about','tell','show','give','have','has','any']);
    const tokens = raw.replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(t=>t&&!stop.has(t));
    if(!tokens.length) return fallbackReply(raw);
    let best=null, bestScore=0;
    for(const e of KB){
      let score=0;
      for(const k of e.k){
        const kTokens=k.toLowerCase().split(/\s+/);
        for(const kt of kTokens) for(const t of tokens){
          if(kt===t) score+=2;
          else if(kt.length>3&&t.length>3&&(kt.includes(t)||t.includes(kt))) score+=1;
        }
      }
      if(score>bestScore){bestScore=score;best=e;}
    }
    if(best&&bestScore>=1) return best.r();
    return fallbackReply(raw);
  }

  // ============ BERU CHAT ============
  const BERU_BACKEND_URL = "https://beru-backend-2szw.onrender.com";
  const beruHistory = [];
  const body_el = document.getElementById('beru-body');
  const inputEl = document.getElementById('beru-input');
  const sendBtn = document.getElementById('beru-send');
  const closeBtn = document.getElementById('beru-close');
  const prompts = document.getElementById('beru-prompts');
  let opened = false;

  function addMsg(html, who){
    const el = document.createElement('div');
    el.className = 'msg '+who;
    el.innerHTML = html;
    body_el.appendChild(el);
    body_el.scrollTop = body_el.scrollHeight;
    return el;
  }
  function addTyping(){
    const el = document.createElement('div');
    el.className = 'msg bot typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    body_el.appendChild(el);
    body_el.scrollTop = body_el.scrollHeight;
    return el;
  }
  function formatReply(text){
    if(!text) return '';
    const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const linked = escaped.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
    return linked.replace(/\n/g,'<br>');
  }

  async function send(text){
    if(!text||!text.trim()) return;
    addMsg(text.replace(/</g,'&lt;'), 'user');
    inputEl.value = '';
    const typing = addTyping();
    beruHistory.push({role:'user',content:text});
    let reply = null;
    let usedFallback = false;
    try {
      const res = await fetch(BERU_BACKEND_URL+'/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:beruHistory})
      });
      if(res.ok){
        const data = await res.json();
        reply = data&&data.reply ? data.reply : null;
      } else { console.warn('B.E.R.U backend returned',res.status); }
    } catch(err){ console.warn('B.E.R.U backend unreachable, using local fallback:',err); }
    if(!reply){ reply = lookup(text); usedFallback = true; }
    typing.remove();
    if(usedFallback){ addMsg(reply,'bot'); }
    else { addMsg(formatReply(reply),'bot'); beruHistory.push({role:'assistant',content:reply}); }
  }

  launcher.addEventListener('click', () => {
    panel.classList.add('open');
    launcher.classList.add('hidden');
    if(!opened){
      opened = true;
      setTimeout(()=>{ addMsg(`<strong>B.E.R.U online.</strong> I'm ${NAME}'s personal AI assistant - ask me anything about his work, background, or how to reach him.`, 'bot'); }, 350);
      setTimeout(()=>{ addMsg(`Try a quick prompt below or type your own question.`, 'bot'); }, 1400);
    }
    setTimeout(()=>inputEl.focus(), 400);
  });
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open');
    launcher.classList.remove('hidden');
  });
  sendBtn.addEventListener('click', ()=>send(inputEl.value));
  inputEl.addEventListener('keydown', e=>{ if(e.key==='Enter'){e.preventDefault();send(inputEl.value);} });
  prompts.querySelectorAll('.qp').forEach(b=>b.addEventListener('click',()=>send(b.dataset.q||b.textContent)));
  body_el.addEventListener('click', e=>{
    const t = e.target.closest('.inline-qp');
    if(t) send(t.dataset.q||t.textContent);
  });


  // ============ PROJECT MODAL ============
  (function(){
    const PROJECTS = [
      {
        num: '01 · TELECOM',
        metric: '86% accuracy',
        title: 'Telecom Customer Churn Prediction',
        tagline: 'Keeping customers before they leave.',
        what: 'A machine learning classification system built to predict which telecom customers are likely to churn - enabling the business to intervene proactively with targeted retention strategies before losing the customer.',
        did: [
          'Built end-to-end ML pipeline from raw customer data to deployed predictions',
          'Trained and compared <strong>Random Forest</strong> and <strong>XGBoost</strong> classifiers',
          'Achieved <strong>86% classification accuracy</strong> on held-out test data',
          'Engineered features from usage patterns, billing history, and service interactions',
          'Produced actionable churn probability scores for each customer segment'
        ],
        tags: ['Random Forest','XGBoost','Python','Scikit-learn','Feature Engineering']
      },
      {
        num: '02 · COMPUTER VISION',
        metric: '~90% accuracy',
        title: 'Plant Disease Detection',
        tagline: 'Catching crop disease before it spreads.',
        what: 'A deep learning image classification system that identifies plant diseases from leaf photographs. Designed to give farmers and agronomists an early-warning tool that reduces crop losses by catching disease at the earliest visible stage.',
        did: [
          'Built a <strong>Convolutional Neural Network (CNN)</strong> using TensorFlow/Keras',
          'Trained on a labelled dataset of healthy and diseased leaf images',
          'Achieved <strong>~90% accuracy</strong> across multiple disease categories',
          'Applied data augmentation (rotation, flipping, zoom) to improve generalisation',
          'Packaged the model for inference on new images'
        ],
        tags: ['CNN','TensorFlow','Keras','Computer Vision','Data Augmentation','Python']
      },
      {
        num: '03 · NLP',
        metric: '82% F1-score',
        title: 'Twitter Sentiment Analysis',
        tagline: 'Turning tweets into brand intelligence.',
        what: 'An NLP pipeline that classifies the sentiment of tweets at scale, built for brand monitoring use cases. The system processes large volumes of social media text and labels each tweet as positive, negative, or neutral - giving brands a real-time read of public opinion.',
        did: [
          'Processed and cleaned a dataset of <strong>50,000+ tweets</strong>',
          'Applied tokenisation, stop-word removal, and TF-IDF vectorisation',
          'Trained supervised classifiers and achieved <strong>82% F1-score</strong>',
          'Handled class imbalance using resampling techniques',
          'Built a reusable pipeline suitable for live social media monitoring'
        ],
        tags: ['NLP','Scikit-learn','TF-IDF','Python','Text Classification','NLTK']
      },
      {
        num: '04 · IoT + ML',
        metric: '~90% accuracy',
        title: 'IoT-Based Air Quality Monitoring',
        tagline: 'Real-time pollution intelligence from sensor data.',
        what: 'A hybrid IoT and machine learning system that ingests live sensor readings and predicts ambient air quality levels in real time. The project combined hardware data collection with ML-based forecasting and was presented at a National Conference in 2024.',
        did: [
          'Designed and integrated a <strong>sensor-based IoT data collection</strong> system',
          'Built ML regression models to predict pollution level from sensor readings',
          'Achieved <strong>~90% prediction accuracy</strong> on real-world air quality data',
          'Developed real-time data pipeline from hardware to model inference',
          '<strong>Presented findings at a National Conference (2024)</strong> - peer-reviewed paper'
        ],
        tags: ['IoT','Machine Learning','Python','Regression','Real-time ML','Conference Paper']
      },
      {
        num: '05 · UNSUPERVISED ML',
        metric: '~85% accuracy',
        title: 'E-commerce Customer Segmentation',
        tagline: 'Finding the customers worth keeping.',
        what: 'An unsupervised learning project that segments e-commerce customers into meaningful groups based on purchasing behaviour, demographics, and engagement patterns. The segments were then used to power targeted marketing and retention strategies.',
        did: [
          'Applied <strong>K-Means and Hierarchical clustering</strong> to customer transaction data',
          'Identified high-value, at-risk, and dormant customer segments',
          'Boosted targeted marketing effectiveness and retention by <strong>15-20%</strong>',
          'Used dimensionality reduction (PCA) to visualise cluster separation',
          'Delivered segment profiles and actionable recommendations for each cluster'
        ],
        tags: ['K-Means','Hierarchical Clustering','PCA','Scikit-learn','Python','Pandas']
      },
      {
        num: '06 · LLM + GRADIO',
        metric: 'Microsoft Phi-1.5',
        title: 'AI Health Assistant Chatbot',
        tagline: 'Ask a question. Get a fair, grounded answer.',
        what: 'A conversational AI chatbot built using Microsoft Phi-1.5 (a compact but capable language model from HuggingFace) with a Gradio web interface. Designed specifically for general health queries, with a system prompt that enforces fairness, impartiality, and unbiased responses regardless of the user\'s background.',
        did: [
          'Loaded and ran <strong>Microsoft Phi-1.5</strong> via HuggingFace Transformers',
          'Built a custom <strong>Gradio UI</strong> - clean chat interface deployable in a browser',
          'Engineered a detailed <strong>system prompt</strong> enforcing fairness, no bias by sex, religion, caste, nationality or race',
          'Implemented text generation with <strong>top-k and nucleus sampling</strong> (top_k=50, top_p=0.9) for natural responses',
          'Handled post-processing to clean model output and strip generation artefacts',
          'Deployed the full pipeline end-to-end in Google Colab'
        ],
        tags: ['Transformers','Gradio','Microsoft Phi-1.5','HuggingFace','Python','LLM','Prompt Engineering','Google Colab']
      },
      {
        num: '07 · MSc DISSERTATION',
        metric: 'In Progress · 2025-26',
        title: 'Prompt Engineering for AI Language Models',
        tagline: 'How you ask shapes what you get.',
        what: 'My MSc dissertation at the University of Liverpool. Investigating how the design and structure of prompts systematically affect the behaviour, output quality, and reliability of large language models - with a focus on building evaluation frameworks that can measure these effects rigorously.',
        did: [
          'Designing a systematic study of <strong>prompt structure and model behaviour</strong>',
          'Exploring chain-of-thought, few-shot, and zero-shot prompting strategies',
          'Building <strong>evaluation frameworks</strong> to measure prompt effectiveness quantitatively',
          'Investigating prompt sensitivity across different LLM architectures',
          'Producing research findings relevant to production AI engineering'
        ],
        tags: ['LLMs','Prompt Engineering','NLP','Evaluation','Chain-of-Thought','Python','Research']
      }
    ];

    const modal      = document.getElementById('proj-modal');
    const backdrop   = document.getElementById('proj-modal-backdrop');
    const closeBtn   = document.getElementById('proj-modal-close');
    const mNum       = document.getElementById('proj-modal-num');
    const mMetric    = document.getElementById('proj-modal-metric');
    const mTitle     = document.getElementById('proj-modal-title');
    const mTagline   = document.getElementById('proj-modal-tagline');
    const mWhat      = document.getElementById('proj-modal-what');
    const mDid       = document.getElementById('proj-modal-did');
    const mTags      = document.getElementById('proj-modal-tags');
    if(!modal) return;

    function openModal(idx){
      const p = PROJECTS[idx];
      if(!p) return;
      mNum.textContent     = p.num;
      mMetric.textContent  = p.metric;
      mTitle.textContent   = p.title;
      mTagline.textContent = p.tagline;
      mWhat.textContent    = p.what;
      mDid.innerHTML       = p.did.map(d => '<li>' + d + '</li>').join('');
      mTags.innerHTML      = p.tags.map(t =>
        '<span class="proj-tag">' + t + '</span>'
      ).join('');
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }

    function closeModal(){
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }

    // Card clicks
    document.querySelectorAll('.proj-card[data-proj]').forEach(card => {
      card.addEventListener('click', e => {
        // Don't open if user is dragging
        const idx = parseInt(card.dataset.proj);
        if(!isNaN(idx)) openModal(idx);
      });
      card.addEventListener('keydown', e => {
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          const idx = parseInt(card.dataset.proj);
          if(!isNaN(idx)) openModal(idx);
        }
      });
    });

    // Close
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape') closeModal();
    });
  })();

})();

/* ═══════════════════════════════════════ */

// ============================================================
// CINEMATIC SUB-ELEMENT CASCADE
// Isolated, reduced-motion aware. Adds staggered reveal to
// existing blocks. No content change, no B.E.R.U interaction.
// ============================================================
(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const sel = '.exp-entry, .edu-entry, .recog-card, .toolkit-group, .roadmap-col, .contact-link-row';
  const els = Array.from(document.querySelectorAll(sel));
  if(!els.length) return;
  els.forEach(el => el.classList.add('cine'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if(!en.isIntersecting) return;
      const el = en.target;
      const sibs = el.parentElement
        ? Array.from(el.parentElement.children).filter(c => c.classList.contains('cine'))
        : [el];
      const i = Math.max(0, sibs.indexOf(el));
      el.style.transitionDelay = (i * 0.08).toFixed(2) + 's';
      el.classList.add('cine-in');
      io.unobserve(el);
    });
  }, { threshold: 0.15 });
  els.forEach(el => io.observe(el));
})();

/* ═══════════════════════════════════════ */

// ============================================================
// SMOOTH SCROLL (Enzo-style inertia) via Lenis
// Isolated. Disabled for reduced-motion. Inner scrollers opted out.
// Does NOT touch B.E.R.U logic.
// ============================================================
(function(){
  if(typeof Lenis === 'undefined') return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Keep native scrolling inside the chat + project modal
  ['beru-body','proj-modal-panel'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.setAttribute('data-lenis-prevent','');
  });

  const lenis = new Lenis({
    lerp: 0.08,           // iOS Liquid Glass silk - longer glide, native feel
    wheelMultiplier: 1,
    smoothWheel: true
  });
  window.__lenis = lenis;

  // Hand scroll control fully to Lenis (avoid native smooth-scroll fighting it)
  document.documentElement.style.scrollBehavior = 'auto';
  document.documentElement.classList.add('lenis-smooth');

  // Sync ScrollTrigger with Lenis so pinning + reveal timelines feel perfect
  if(typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined'){
    gsap.registerPlugin(ScrollTrigger);
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    function raf(time){ lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  }

  // Smooth anchor navigation (skips bare "#" used by B.E.R.U buttons)
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if(href && href.length > 1){
        const target = document.querySelector(href);
        if(target){ e.preventDefault(); lenis.scrollTo(target, { offset: -10 }); }
      }
    });
  });
})();

/* ═══════════════════════════════════════ */

// ============================================================
// CINEMATIC SITE FX - scroll progress, count-up metrics,
// 3D tilt-on-hover, nav active-section. Isolated, guarded.
// Does NOT touch B.E.R.U logic.
// ============================================================
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoverable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ---- Scroll progress bar ----
  const bar = document.getElementById('scroll-progress');
  if(bar){
    const update = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  // ---- Count-up project metrics on reveal ----
  function countUp(el){
    const txt = el.dataset.raw || el.textContent;
    el.dataset.raw = txt;
    const m = txt.match(/^([~]?)(\d+)(.*)$/);   // only "86% accuracy", "~90% ...", etc.
    if(!m || txt.indexOf('%') === -1){ return; }
    const prefix = m[1], target = parseInt(m[2]), suffix = m[3];
    if(reduce){ el.textContent = prefix + target + suffix; el.classList.add('counted'); return; }
    const dur = 950, t0 = performance.now();
    (function step(now){
      const p = Math.min(1, (now - t0) / dur);
      const val = Math.round((1 - Math.pow(1 - p, 3)) * target);
      el.textContent = prefix + val + suffix;
      if(p < 1) requestAnimationFrame(step);
      else { el.textContent = prefix + target + suffix; el.classList.add('counted'); }
    })(t0);
  }
  const metrics = document.querySelectorAll('.proj-metric');
  if(metrics.length){
    const mio = new IntersectionObserver(es => {
      es.forEach(en => { if(en.isIntersecting){ countUp(en.target); mio.unobserve(en.target); } });
    }, { threshold: 0.6 });
    metrics.forEach(el => mio.observe(el));
  }

  // ---- 3D tilt-on-hover (desktop only) ----
  if(hoverable && !reduce){
    document.querySelectorAll('.recog-card, .toolkit-group').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(750px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-3px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  // ---- Nav active-section highlight ----
  const navLinks = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  const map = {};
  navLinks.forEach(a => { const id = a.getAttribute('href').slice(1); if(id) map[id] = a; });
  const ids = Object.keys(map);
  if(ids.length){
    const nio = new IntersectionObserver(es => {
      es.forEach(en => {
        if(en.isIntersecting){
          navLinks.forEach(a => a.classList.remove('active'));
          if(map[en.target.id]) map[en.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    ids.forEach(id => { const s = document.getElementById(id); if(s) nio.observe(s); });
  }
})();

/* ═══════════════════════════════════════ */

// ============================================================
// 3D SCROLL UNIVERSE - Parallel-style scene controller
// Full-screen WebGL background. Currently: hero nebula.
// (More scenes added in next pass after approval.)
// Mobile-aware, reduced-motion safe, B.E.R.U untouched.
// ============================================================
(function(){
  if(typeof THREE === 'undefined') return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.getElementById('scene-canvas');
  if(!canvas) return;

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.z = 50;

  // ---------- HERO NEBULA: crimson particle field ----------
  const COUNT = isMobile ? 1200 : 3500;
  const positions = new Float32Array(COUNT * 3);
  const colors    = new Float32Array(COUNT * 3);
  const sizes     = new Float32Array(COUNT);

  const c1 = new THREE.Color('#FFB37A');
  const c2 = new THREE.Color('#FF7A1A');
  const c3 = new THREE.Color('#071022');

  for(let i = 0; i < COUNT; i++){
    // Distribute in a spiral/sphere cloud
    const r = 8 + Math.pow(Math.random(), 0.55) * 40;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i*3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i*3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55;   // flatten
    positions[i*3 + 2] = r * Math.cos(phi);

    // Tri-blend color
    const t = Math.random();
    const col = t < 0.4 ? c1 : (t < 0.85 ? c2 : c3);
    colors[i*3 + 0] = col.r;
    colors[i*3 + 1] = col.g;
    colors[i*3 + 2] = col.b;

    sizes[i] = 0.25 + Math.random() * 1.6;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

  // Soft round particle texture via canvas
  function makeSpriteTexture(){
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,200,210,0.9)');
    g.addColorStop(0.55, 'rgba(255,122,26,0.45)');
    g.addColorStop(1,    'rgba(255,122,26,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  const sprite = makeSpriteTexture();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:   { value: 0 },
      uScroll: { value: 0 },
      uMap:    { value: sprite }
    },
    vertexShader: `
      attribute float aSize;
      uniform float uTime;
      uniform float uScroll;
      varying vec3 vColor;
      void main(){
        vColor = color;
        vec3 p = position;
        // gentle swirl driven by scroll
        float a = uTime * 0.06 + uScroll * 1.3;
        float ca = cos(a), sa = sin(a);
        vec3 rp = vec3(p.x * ca - p.z * sa, p.y, p.x * sa + p.z * ca);
        vec4 mv = modelViewMatrix * vec4(rp, 1.0);
        gl_PointSize = aSize * (300.0 / -mv.z) * (1.0 + uScroll * 0.5);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec3 vColor;
      void main(){
        vec4 t = texture2D(uMap, gl_PointCoord);
        if(t.a < 0.02) discard;
        gl_FragColor = vec4(vColor, t.a * 0.95);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // ---------- ABOUT SCENE: wireframe icosahedron + satellites ----------
  const aboutGroup = new THREE.Group();
  aboutGroup.position.set(0, 0, -10);
  aboutGroup.visible = false;
  scene.add(aboutGroup);

  // Main wireframe icosahedron
  const icoGeo = new THREE.IcosahedronGeometry(7, 1);
  const icoEdges = new THREE.EdgesGeometry(icoGeo);
  const icoMat = new THREE.LineBasicMaterial({
    color: 0xe11d48,
    transparent: true,
    opacity: 0.85
  });
  const ico = new THREE.LineSegments(icoEdges, icoMat);
  aboutGroup.add(ico);

  // Subtle inner solid (very dim) for depth
  const icoFillMat = new THREE.MeshBasicMaterial({
    color: 0x5b0019,
    transparent: true,
    opacity: 0.18,
    wireframe: false
  });
  const icoFill = new THREE.Mesh(icoGeo, icoFillMat);
  aboutGroup.add(icoFill);

  // Satellite points orbiting the icosahedron
  const SAT = isMobile ? 200 : 500;
  const satPos = new Float32Array(SAT * 3);
  const satCol = new Float32Array(SAT * 3);
  const satSize = new Float32Array(SAT);
  for(let i = 0; i < SAT; i++){
    const r = 9 + Math.random() * 6;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    satPos[i*3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    satPos[i*3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    satPos[i*3 + 2] = r * Math.cos(phi);
    const col = Math.random() < 0.5 ? c1 : c2;
    satCol[i*3 + 0] = col.r;
    satCol[i*3 + 1] = col.g;
    satCol[i*3 + 2] = col.b;
    satSize[i] = 0.6 + Math.random() * 1.4;
  }
  const satGeo = new THREE.BufferGeometry();
  satGeo.setAttribute('position', new THREE.BufferAttribute(satPos, 3));
  satGeo.setAttribute('color',    new THREE.BufferAttribute(satCol, 3));
  satGeo.setAttribute('aSize',    new THREE.BufferAttribute(satSize, 1));
  const satMat = mat.clone();    // reuse shader/uniforms
  satMat.uniforms = mat.uniforms; // share time/scroll
  const satellites = new THREE.Points(satGeo, satMat);
  aboutGroup.add(satellites);

  // ---------- EXPERIENCE SCENE: timeline rail of points stretching into distance ----------
  const expGroup = new THREE.Group();
  expGroup.visible = false;
  scene.add(expGroup);
  const RAIL_LEN = 80;
  const RAIL_COUNT = isMobile ? 80 : 160;
  const railPos = new Float32Array(RAIL_COUNT * 3);
  const railCol = new Float32Array(RAIL_COUNT * 3);
  const railSize = new Float32Array(RAIL_COUNT);
  for(let i = 0; i < RAIL_COUNT; i++){
    const t = i / (RAIL_COUNT - 1);
    railPos[i*3 + 0] = (Math.random() - 0.5) * 6;
    railPos[i*3 + 1] = (Math.random() - 0.5) * 4;
    railPos[i*3 + 2] = -t * RAIL_LEN;
    const col = (i % 7 === 0) ? c1 : c2;
    railCol[i*3 + 0] = col.r;
    railCol[i*3 + 1] = col.g;
    railCol[i*3 + 2] = col.b;
    railSize[i] = 1.2 + Math.random() * 1.8;
  }
  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.BufferAttribute(railPos, 3));
  railGeo.setAttribute('color',    new THREE.BufferAttribute(railCol, 3));
  railGeo.setAttribute('aSize',    new THREE.BufferAttribute(railSize, 1));
  const rail = new THREE.Points(railGeo, mat);
  expGroup.add(rail);

  // ---------- PROJECTS SCENE: 7 floating wireframe cubes orbiting a central axis ----------
  const projGroup = new THREE.Group();
  projGroup.visible = false;
  scene.add(projGroup);
  const PROJ_N = 7;
  const cubes = [];
  for(let i = 0; i < PROJ_N; i++){
    const cubeGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const cubeEdges = new THREE.EdgesGeometry(cubeGeo);
    const cubeMat = new THREE.LineBasicMaterial({
      color: 0xe11d48,
      transparent: true,
      opacity: 0
    });
    const cube = new THREE.LineSegments(cubeEdges, cubeMat);
    const angle = (i / PROJ_N) * Math.PI * 2;
    cube.userData = { angle, radius: 8, mat: cubeMat };
    projGroup.add(cube);
    cubes.push(cube);
  }

  // ---------- SKILLS SCENE: wireframe torus knot (interconnected systems) ----------
  const skillsGroup = new THREE.Group();
  skillsGroup.visible = false;
  scene.add(skillsGroup);
  const knotGeo = new THREE.TorusKnotGeometry(5, 1.2, 80, 14, 2, 3);
  const knotEdges = new THREE.EdgesGeometry(knotGeo);
  const knotMat = new THREE.LineBasicMaterial({ color: 0xFFB800, transparent: true, opacity: 0 });
  const knot = new THREE.LineSegments(knotEdges, knotMat);
  skillsGroup.add(knot);

  // ---------- EDUCATION SCENE: slow-rotating wireframe ring ----------
  const eduGroup = new THREE.Group();
  eduGroup.visible = false;
  scene.add(eduGroup);
  const ringGeo = new THREE.TorusGeometry(6, 0.4, 8, 64);
  const ringEdges = new THREE.EdgesGeometry(ringGeo);
  const ringMat = new THREE.LineBasicMaterial({ color: 0xe11d48, transparent: true, opacity: 0 });
  const ring = new THREE.LineSegments(ringEdges, ringMat);
  ring.rotation.x = Math.PI * 0.35;
  eduGroup.add(ring);
  const ringInnerGeo = new THREE.TorusGeometry(3.5, 0.3, 8, 48);
  const ringInnerEdges = new THREE.EdgesGeometry(ringInnerGeo);
  const ringInnerMat = new THREE.LineBasicMaterial({ color: 0xFFB800, transparent: true, opacity: 0 });
  const ringInner = new THREE.LineSegments(ringInnerEdges, ringInnerMat);
  ringInner.rotation.x = -Math.PI * 0.35;
  eduGroup.add(ringInner);

  // ---------- CONTACT SCENE: particles converging to a focal point ----------
  const contactGroup = new THREE.Group();
  contactGroup.visible = false;
  scene.add(contactGroup);
  const CON_N = isMobile ? 400 : 900;
  const conPos = new Float32Array(CON_N * 3);
  const conStart = new Float32Array(CON_N * 3);
  const conCol = new Float32Array(CON_N * 3);
  const conSize = new Float32Array(CON_N);
  for(let i = 0; i < CON_N; i++){
    const r = 8 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    conStart[i*3 + 0] = x; conStart[i*3 + 1] = y; conStart[i*3 + 2] = z;
    conPos[i*3 + 0] = x;   conPos[i*3 + 1] = y;   conPos[i*3 + 2] = z;
    const col = Math.random() < 0.5 ? c1 : c2;
    conCol[i*3 + 0] = col.r;
    conCol[i*3 + 1] = col.g;
    conCol[i*3 + 2] = col.b;
    conSize[i] = 0.8 + Math.random() * 1.8;
  }
  const conGeo = new THREE.BufferGeometry();
  conGeo.setAttribute('position', new THREE.BufferAttribute(conPos, 3));
  conGeo.setAttribute('color',    new THREE.BufferAttribute(conCol, 3));
  conGeo.setAttribute('aSize',    new THREE.BufferAttribute(conSize, 1));
  const contactPoints = new THREE.Points(conGeo, mat);
  contactGroup.add(contactPoints);

  // ---------- animation + scroll ----------
  let scrollTarget = 0, scroll = 0;
  function onScroll(){
    scrollTarget = Math.min(1, window.scrollY / window.innerHeight);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  function onResize(){
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize, { passive: true });

  let mx = 0, my = 0, tmx = 0, tmy = 0;
  window.addEventListener('mousemove', e => {
    tmx = (e.clientX / window.innerWidth - 0.5) * 2;
    tmy = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  // Page-progress: 0 at top, 1 at very bottom
  let pageTarget = 0, pageProg = 0;
  function updatePageProgress(){
    const h = document.documentElement.scrollHeight - window.innerHeight;
    pageTarget = h > 0 ? window.scrollY / h : 0;
  }
  window.addEventListener('scroll', updatePageProgress, { passive: true });
  updatePageProgress();

  let fadeIn = 0;   // 0 → 1 over ~1s on first render
  function tick(){
    requestAnimationFrame(tick);
    mat.uniforms.uTime.value += 0.016;
    scroll    += (scrollTarget - scroll) * 0.12;
    pageProg  += (pageTarget   - pageProg) * 0.18;
    mat.uniforms.uScroll.value = scroll;
    mx += (tmx - mx) * 0.05;
    my += (tmy - my) * 0.05;

    // ---- HERO nebula (only while at hero) ----
    const heroFade = Math.max(0, 1 - scroll * 0.85);
    points.visible = heroFade > 0.02 && pageProg < 0.1;
    points.rotation.y += 0.0015;
    points.rotation.x = my * 0.15;
    points.scale.setScalar(0.85 + heroFade * 0.15);

    // ---- ABOUT scene ----
    const aboutA = smoothstep(0.05, 0.16, pageProg) * (1 - smoothstep(0.22, 0.30, pageProg));
    aboutGroup.visible = aboutA > 0.01;
    if(aboutGroup.visible){
      ico.rotation.x += 0.0025;
      ico.rotation.y += 0.0035;
      icoFill.rotation.x = ico.rotation.x;
      icoFill.rotation.y = ico.rotation.y;
      satellites.rotation.y -= 0.0018;
      satellites.rotation.x = my * 0.1;
      aboutGroup.position.set(13 + mx * 1.2, (1 - aboutA) * -3, -2);
      aboutGroup.scale.setScalar(0.9 + aboutA * 0.35);
      icoMat.opacity     = 0.85 * aboutA;
      icoFillMat.opacity = 0.18 * aboutA;
    }

    // ---- EXPERIENCE scene (timeline rail extruding into distance) ----
    const expA = smoothstep(0.24, 0.32, pageProg) * (1 - smoothstep(0.36, 0.44, pageProg));
    expGroup.visible = expA > 0.01;
    if(expGroup.visible){
      rail.rotation.z += 0.0009;
      // Push the rail "toward" viewer as scroll deepens, giving sense of moving along a timeline
      expGroup.position.set(mx * 2, my * -1, 30 - expA * 25);
      expGroup.scale.setScalar(0.8 + expA * 0.5);
    }

    // ---- PROJECTS scene (orbiting cubes) ----
    const projA = smoothstep(0.40, 0.50, pageProg) * (1 - smoothstep(0.62, 0.70, pageProg));
    projGroup.visible = projA > 0.01;
    if(projGroup.visible){
      projGroup.rotation.y += 0.0035;
      projGroup.position.set(mx * 1.5, my * -1, -2);
      projGroup.scale.setScalar(0.75 + projA * 0.4);
      for(const cube of cubes){
        const a = cube.userData.angle + projGroup.rotation.y * 0.5;
        cube.position.x = Math.cos(a) * cube.userData.radius;
        cube.position.z = Math.sin(a) * cube.userData.radius;
        cube.position.y = Math.sin(mat.uniforms.uTime.value * 0.6 + cube.userData.angle * 3) * 1.2;
        cube.rotation.x += 0.005;
        cube.rotation.y += 0.008;
        cube.userData.mat.opacity = 0.85 * projA;
      }
    }

    // ---- SKILLS scene (torus knot) ----
    const skillsA = smoothstep(0.62, 0.70, pageProg) * (1 - smoothstep(0.78, 0.84, pageProg));
    skillsGroup.visible = skillsA > 0.01;
    if(skillsGroup.visible){
      knot.rotation.x += 0.0025;
      knot.rotation.y += 0.0045;
      skillsGroup.position.set(12 + mx * 1.2, my * -1, 0);
      skillsGroup.scale.setScalar(0.85 + skillsA * 0.35);
      knotMat.opacity = 0.85 * skillsA;
    }

    // ---- EDUCATION scene (double rings) ----
    const eduA = smoothstep(0.80, 0.86, pageProg) * (1 - smoothstep(0.90, 0.94, pageProg));
    eduGroup.visible = eduA > 0.01;
    if(eduGroup.visible){
      ring.rotation.z += 0.002;
      ringInner.rotation.z -= 0.003;
      eduGroup.position.set(-12 + mx * 1.2, my * -1, 0);
      eduGroup.scale.setScalar(0.85 + eduA * 0.35);
      ringMat.opacity      = 0.85 * eduA;
      ringInnerMat.opacity = 0.75 * eduA;
    }

    // ---- CONTACT scene (particles converging) ----
    const contactA = smoothstep(0.92, 0.96, pageProg);
    contactGroup.visible = contactA > 0.01;
    if(contactGroup.visible){
      // Lerp each particle toward origin based on contactA
      const arr = conGeo.attributes.position.array;
      for(let i = 0; i < CON_N; i++){
        const sx = conStart[i*3 + 0];
        const sy = conStart[i*3 + 1];
        const sz = conStart[i*3 + 2];
        arr[i*3 + 0] = sx * (1 - contactA);
        arr[i*3 + 1] = sy * (1 - contactA);
        arr[i*3 + 2] = sz * (1 - contactA);
      }
      conGeo.attributes.position.needsUpdate = true;
      contactGroup.rotation.y += 0.003;
      contactGroup.position.set(mx * 1.2, my * -0.8, 0);
    }

    // Camera - push-in during hero, settle back after
    if(pageProg < 0.1){
      camera.position.z = 50 - scroll * 18;
      camera.position.x = mx * 3;
      camera.position.y = 0;
    } else {
      camera.position.z = 35;
      camera.position.x = mx * 2;
      camera.position.y = -my * 1.5;
    }
    camera.lookAt(0, 0, 0);

    // overall canvas alpha
    fadeIn = Math.min(1, fadeIn + 0.025);
    let sceneAlpha;
    if(pageTarget < 0.05){
      sceneAlpha = heroFade;
    } else {
      sceneAlpha = Math.max(heroFade, aboutA, expA, projA, skillsA, eduA, contactA, 0.4);
    }
    canvas.style.opacity = (fadeIn * sceneAlpha).toFixed(3);
    renderer.render(scene, camera);
  }
  function smoothstep(a, b, t){
    t = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  // Start ticking immediately - first frame paints, then keep rendering
  requestAnimationFrame(()=>{
    canvas.classList.add('ready');
    document.body.classList.add('hero-revealed');
    tick();
  });
})();

/* ═══════════════════════════════════════ */

// ============================================================
// CINEMATIC PINNED-SCROLL STORYTELLING
// Pins each section, reveals content choreographed to scroll.
// Tied to Lenis. Does NOT touch B.E.R.U.
// ============================================================
(function(){
  if(typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  const SECTION_IDS = ['about','experience','projects','toolkit','education','recognition','resume','contact'];

  function buildScenes(){
    SECTION_IDS.forEach(id => {
      const section = document.getElementById(id);
      if(!section || section.dataset.cinemaReady) return;
      section.dataset.cinemaReady = '1';

      // Wrap content in .cine-pin-inner
      if(!section.querySelector(':scope > .cine-pin-inner')){
        const inner = document.createElement('div');
        inner.className = 'cine-pin-inner';
        while(section.firstChild) inner.appendChild(section.firstChild);
        section.appendChild(inner);
      }
      section.classList.add('cine-pin');

      const inner = section.querySelector(':scope > .cine-pin-inner');
      const title = inner.querySelector('.sec-title');
      const label = inner.querySelector('.sec-label');
      const rest  = Array.from(inner.children).filter(el => el !== title && el !== label);

      // Snappy cinematic reveal on enter - no pinning, no extra scroll length
      const seq = [title, ...rest].filter(Boolean);
      gsap.set(seq, { opacity: 0, y: 50 });
      ScrollTrigger.create({
        trigger: section,
        start: 'top 80%',
        once: true,
        onEnter: () => {
          gsap.to(seq, {
            opacity: 1, y: 0,
            stagger: isMobile ? 0.08 : 0.14,
            duration: isMobile ? 0.8 : 1.1,
            ease: 'power3.out'
          });
        }
      });
    });

    ScrollTrigger.refresh();
  }

  // Build after fonts + initial render settle
  if(document.readyState === 'complete'){ setTimeout(buildScenes, 600); }
  else { window.addEventListener('load', () => setTimeout(buildScenes, 600)); }
})();

/* ═══════════════════════════════════════ */

// Glass-rebuild bootstrap: wire status card to B.E.R.U, live clock, nav scroll state
(function(){
  // Robust B.E.R.U opener - directly manipulates the chat panel
  function openBeruChat(prefillText){
    const panel = document.getElementById('beru-panel');
    const launcher = document.getElementById('beru-launcher');
    if(launcher) launcher.classList.add('hidden');
    if(panel){
      panel.classList.add('open');
      const inp = document.getElementById('beru-input');
      if(inp){
        if(prefillText){ inp.value = prefillText; }
        setTimeout(() => inp.focus(), 320);
      }
      // If a prefill was provided, auto-send after a tick
      if(prefillText){
        setTimeout(() => {
          const sendBtn = document.getElementById('beru-send');
          if(sendBtn) sendBtn.click();
        }, 400);
      }
    } else if(launcher){
      launcher.click();
    }
  }
  window.__openBeruChat = openBeruChat;

  // Hero status card → open chat
  const card = document.getElementById('hero-status-card');
  if(card){
    card.addEventListener('click', () => openBeruChat());
    card.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openBeruChat(); } });
  }

  // Nav "Talk to B.E.R.U" & hero pill → open chat
  ['nav-beru-btn','hero-beru-btn','drawer-beru-btn'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('click', e => { e.preventDefault(); openBeruChat(); });
  });

  // Bottom dock bar → open chat (click or Enter in input)
  const dock = document.getElementById('beru-dock');
  const dockInput = document.getElementById('beru-dock-input');
  const dockSend = document.getElementById('beru-dock-send');
  if(dock && dockInput){
    const launchFromDock = () => {
      const text = dockInput.value.trim();
      dockInput.value = '';
      openBeruChat(text || undefined);
    };
    dock.addEventListener('click', e => {
      // Only trigger open when clicking the dock chrome, not the input/send
      if(e.target === dock || e.target.classList.contains('beru-dock-avatar') || e.target.classList.contains('beru-dock-label')){
        openBeruChat();
      }
    });
    dockInput.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); launchFromDock(); } });
    if(dockSend) dockSend.addEventListener('click', e => { e.preventDefault(); launchFromDock(); });
  }

  // Keyboard shortcut: "/" focuses dock input
  document.addEventListener('keydown', e => {
    if(e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'){
      e.preventDefault();
      if(dockInput) dockInput.focus();
    }
  });
  // Live clock
  const clock = document.getElementById('gm-clock');
  function updateClock(){
    if(!clock) return;
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    clock.textContent = `${hh}:${mm} LPL`;
  }
  updateClock(); setInterval(updateClock, 30000);
  // Nav active-state on scroll
  const navLinks = document.querySelectorAll('.gm-nav-links a[href^="#"]');
  function syncActive(){
    const y = window.scrollY + window.innerHeight * 0.3;
    let best = null;
    document.querySelectorAll('section[id]').forEach(s => {
      if(s.offsetTop <= y) best = s.id;
    });
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + best));
  }
  window.addEventListener('scroll', syncActive, { passive: true });
  syncActive();
  // Fade in hero shell on load
  requestAnimationFrame(() => {
    const shell = document.querySelector('.gm-shell');
    if(shell){
      shell.style.opacity = '0';
      shell.style.transform = 'translateY(14px) scale(0.985)';
      requestAnimationFrame(() => {
        shell.style.transition = 'opacity 1.2s var(--ease-ios), transform 1.2s var(--ease-ios)';
        shell.style.opacity = '1';
        shell.style.transform = 'translateY(0) scale(1)';
      });
    }
  });
})();

/* ═══════════════════════════════════════ */

(function(){
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  const links = nav.querySelectorAll('.gm-nav-links a, .nav-links a');
  const map = new Map();
  links.forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#') && href.length > 1) {
      const t = document.getElementById(href.slice(1));
      if (t) map.set(t, a);
    }
  });
  if (!map.size) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.remove('is-active'));
        const a = map.get(e.target);
        if (a) a.classList.add('is-active');
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
  map.forEach((_a, section) => io.observe(section));
})();

/* ═══════════════════════════════════════ */

(function(){
  const nav = document.getElementById('main-nav');
  if (!nav) return;
  let lastY = 0, ticking = false;
  const onScroll = () => {
    const y = window.scrollY || window.pageYOffset;
    // Fade out when scrolled past the first viewport, OR when scrolling down
    if (y > 400 && y > lastY) {
      nav.classList.add('nav-faded');
    } else if (y < 100 || y < lastY - 20) {
      nav.classList.remove('nav-faded');
    }
    lastY = y;
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  // Also: show on hover near top of screen
  document.addEventListener('mousemove', (e) => {
    if (e.clientY < 80) nav.classList.remove('nav-faded');
  }, { passive: true });
})();

/* ═══════════════════════════════════════════════════════════════════════
   3D TILT CARDS - cursor-driven perspective depth on the glass panels.
   Desktop + fine-pointer only; disabled for reduced-motion.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduced) return;

  const SEL = '.exp-entry, .edu-entry, .toolkit-group, .recog-card, .cv-card, .bento-tile, .gm-tile';
  const MAX = 7;        // max degrees of tilt
  const LIFT = 14;      // translateZ lift in px

  let raf = 0, pending = null;

  function apply(card, rx, ry){
    card.style.transform =
      `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${LIFT}px)`;
  }

  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest(SEL);
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1
    const py = (e.clientY - r.top) / r.height;   // 0..1
    const ry = (px - 0.5) * 2 * MAX;             // left/right
    const rx = -(py - 0.5) * 2 * MAX;            // up/down (inverted)
    pending = { card, rx, ry };
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      if (pending){ pending.card.classList.add('is-tilting'); apply(pending.card, pending.rx, pending.ry); }
    });
  }, { passive: true });

  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest(SEL);
    if (!card) return;
    // only reset when the pointer truly leaves the card
    if (card.contains(e.relatedTarget)) return;
    card.classList.remove('is-tilting');
    card.style.transform = '';
  }, { passive: true });
})();


/* ═══════════════════════════════════════════════════════════════════════
   HERO SIGNATURE - 3D point-wave (Three.js).
   A grid of points flowing like a field; peaks tint toward the accent.
   Pointer parallaxes the camera. Reduced-motion renders one static frame.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  const canvas = document.getElementById('vk-wave');
  if (!canvas || typeof THREE === 'undefined') return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 3.1, 7.2);
  camera.lookAt(0, -0.2, 0);

  // grid of points
  const N = 86, SPAN = 11;
  const count = N * N;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const base = new Float32Array(count * 2); // x,z grid coords
  let i = 0;
  for (let a = 0; a < N; a++){
    for (let b = 0; b < N; b++){
      const x = (a / (N-1) - 0.5) * SPAN;
      const z = (b / (N-1) - 0.5) * SPAN;
      base[i*2] = x; base[i*2+1] = z;
      pos[i*3] = x; pos[i*3+1] = 0; pos[i*3+2] = z;
      col[i*3] = 0.95; col[i*3+1] = 0.95; col[i*3+2] = 0.92;
      i++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size:0.045, vertexColors:true, transparent:true, opacity:0.92, sizeAttenuation:true, depthWrite:false });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  // accent colour for peaks
  const ink = { r:0.95, g:0.95, b:0.92 };
  const acc = { r:1.0,  g:0.23, b:0.18 };   // #FF3B2F

  const pointer = { x:0, y:0, tx:0, ty:0 };
  window.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right) { pointer.tx = 0; pointer.ty = 0; return; }
    pointer.tx = ((e.clientX - r.left) / r.width  - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top)  / r.height - 0.5) * 2;
  }, { passive:true });

  function size(){
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  size();
  addEventListener('resize', size, { passive:true });

  const posAttr = geo.attributes.position, colAttr = geo.attributes.color;
  function field(x, z, t){
    return Math.sin(x*0.55 + t) * 0.55
         + Math.sin(z*0.7  - t*0.8) * 0.4
         + Math.sin((x+z)*0.33 + t*0.5) * 0.35;
  }
  function frame(t){
    for (let k = 0; k < count; k++){
      const x = base[k*2], z = base[k*2+1];
      const y = field(x, z, t);
      posAttr.array[k*3+1] = y;
      const h = Math.min(1, Math.max(0, (y + 0.9) / 2.3)); // 0..1 by height
      const m = h*h;
      colAttr.array[k*3]   = ink.r + (acc.r - ink.r)*m;
      colAttr.array[k*3+1] = ink.g + (acc.g - ink.g)*m;
      colAttr.array[k*3+2] = ink.b + (acc.b - ink.b)*m;
    }
    posAttr.needsUpdate = true; colAttr.needsUpdate = true;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    points.rotation.y = pointer.x * 0.25;
    points.rotation.x = pointer.y * 0.12;
    renderer.render(scene, camera);
  }

  if (reduced){ frame(0.6); return; }
  let start = performance.now();
  (function loop(now){
    frame((now - start) / 1000 * 0.6);
    requestAnimationFrame(loop);
  })(start);
})();
