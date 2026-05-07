/* ============================================================
   LOFT DELICIAE — Script principal
   Navigation · Scroll · Animations · FAQ
   ============================================================ */

(function () {
  'use strict';

  /* ── Navigation scrollée ───────────────────────────────────── */
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Burger menu mobile ────────────────────────────────────── */
  const burger = document.getElementById('navBurger');
  const mobileNav = document.getElementById('navMobile');

  if (burger && mobileNav) {
    burger.addEventListener('click', () => {
      const isOpen = burger.classList.toggle('open');
      mobileNav.classList.toggle('open', isOpen);
      burger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        burger.classList.remove('open');
        mobileNav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
        burger.classList.remove('open');
        mobileNav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /* ── Intersection Observer — animations fade-up ────────────── */
  const fadeEls = document.querySelectorAll('.fade-up');
  if (fadeEls.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    fadeEls.forEach(el => observer.observe(el));
  } else {
    fadeEls.forEach(el => el.classList.add('visible'));
  }

  /* ── FAQ accordion ─────────────────────────────────────────── */
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    const toggle = () => {
      const isOpen = item.classList.toggle('open');
      question.setAttribute('aria-expanded', isOpen);
    };

    question.addEventListener('click', toggle);
    question.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  /* ── Smooth scroll pour les ancres ────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').slice(1);
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        const offset = 90;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  /* ── Lien actif selon la page ──────────────────────────────── */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

})();

/* ── Contenu dynamique (textes & photos depuis l'admin) ────── */
(async function loadSiteContent() {
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  try {
    const [tRes, pRes] = await Promise.all([fetch('/api/textes'), fetch('/api/photos')]);
    if (!tRes.ok || !pRes.ok) return;
    const texts  = await tRes.json();
    const photos = await pRes.json();

    // Textes : remplace les éléments portant data-texte="clé"
    document.querySelectorAll('[data-texte]').forEach(el => {
      const v = texts[el.dataset.texte];
      if (v) el.textContent = v;
    });

    // Image hero principale
    const heroEl = document.getElementById('hero-image');
    const heroPhotos = photos.filter(p => p.categorie === 'hero');
    if (heroEl && heroPhotos.length) {
      const img = document.createElement('img');
      img.src = heroPhotos[0].url;
      img.alt = heroPhotos[0].alt || 'Loft Deliciae';
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
      heroEl.appendChild(img);
    }

    // Galerie
    const galerieGrid = document.getElementById('galerie-grid');
    const galeriePhotos = photos.filter(p => p.categorie === 'galerie');
    if (galerieGrid && galeriePhotos.length) {
      const classes = ['gi-1','gi-2','gi-3','gi-4','gi-5','gi-6'];
      galerieGrid.innerHTML = galeriePhotos.map((p, i) => `
        <div class="galerie-item ${classes[i] || ''} fade-up visible" role="listitem">
          <img src="${esc(p.url)}" alt="${esc(p.alt || '')}"
            style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit">
        </div>
      `).join('');
    }

    // Chambre principale (page loft.html)
    const mainPhoto = document.getElementById('main-photo');
    const chambrePhotos = photos.filter(p => p.categorie === 'chambre');
    if (mainPhoto && chambrePhotos.length) {
      const img = document.createElement('img');
      img.src = chambrePhotos[0].url;
      img.alt = chambrePhotos[0].alt || '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;min-height:inherit;border-radius:inherit;';
      mainPhoto.replaceWith(img);
    }

  } catch (_) {}
})();
