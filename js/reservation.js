/* ============================================================
   LOFT DELICIAE — Réservation (connecté à Supabase)
   ============================================================ */

(function () {
  'use strict';

  // Totaux stockés en base : nuit=350, weekend=665 (332.5×2), long=945 (315×3), nuit_longue=300 (par nuit)
  let PRIX_BASE   = { nuit: 350, weekend: 665, long: 945, nuit_longue: 300, semaine: 0 };
  let BOOKED_DATES = new Set();

  async function loadData() {
    try {
      const [datesRes, tarifsRes] = await Promise.all([
        fetch('/api/dates'),
        fetch('/api/tarifs')
      ]);
      const { booked }        = await datesRes.json();
      const { tarifs, extras } = await tarifsRes.json();

      BOOKED_DATES = new Set(booked);
      tarifs.forEach(t => { PRIX_BASE[t.type] = t.prix; });

      tarifs.forEach(t => {
        const opt = document.querySelector(`.duree-option[data-duree="${t.type}"]`);
        if (!opt) return;
        const priceEl = opt.querySelector('.duree-option-price');
        if (!priceEl) return;
        if (t.type === 'semaine') return;
        const fmt = v => v.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        if (t.type === 'nuit') {
          priceEl.textContent = `à partir de ${fmt(t.prix)} €`;
        } else if (t.type === 'weekend') {
          priceEl.textContent = `à partir de ${fmt(t.prix / 2)} €/nuit`;
        } else if (t.type === 'long') {
          priceEl.textContent = `à partir de ${fmt(t.prix / 3)} €/nuit`;
        } else if (t.type === 'nuit_longue') {
          priceEl.textContent = `à partir de ${fmt(t.prix)} €/nuit`;
        }
      });

      renderExtras(extras.filter(e => e.actif));
      buildCalendar();
      updateRecap();
    } catch (e) {
      renderExtras([]);
      buildCalendar();
    }
  }

  const state = {
    currentMonth: new Date().getMonth(),
    currentYear:  new Date().getFullYear(),
    startStr: null, endStr: null, hoverStr: null,
    nuits: 1, extras: new Set(),
  };

  const grid       = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('calMonthLabel');
  const prevBtn    = document.getElementById('calPrev');
  const nextBtn    = document.getElementById('calNext');
  const infoEl     = document.getElementById('dateSelectionInfo');
  const recapArrivee         = document.getElementById('recap-arrivee');
  const recapDepart          = document.getElementById('recap-depart');
  const recapDuree           = document.getElementById('recap-duree');
  const recapPrixBase        = document.getElementById('recap-prix-base');
  const recapExtrasContainer   = document.getElementById('recap-extras-container');
  const recapDiscountContainer = document.getElementById('recap-discount-container');
  const recapTotal             = document.getElementById('recap-total');
  const recapBtn               = document.getElementById('recapBtn');
  const promoInput             = document.getElementById('promoInput');
  const promoBtn               = document.getElementById('promoBtn');
  const promoMsg               = document.getElementById('promoMsg');

  let appliedPromo = null;
  const toast                = document.getElementById('toast');

  if (!grid) return;

  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const TODAY = new Date(); TODAY.setHours(0,0,0,0);

  function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  function formatDateFR(date) {
    if (!date) return '—';
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
  }

  const TODAY_STR = formatDate(new Date());

  function isMonday(ds) {
    return new Date(ds + 'T12:00:00').getDay() === 1;
  }

  // Retourne la date du premier lundi strictement après startStr (dans les 7 prochains jours)
  function firstMondayAfter(startStr) {
    const d = new Date(startStr + 'T12:00:00');
    for (let i = 1; i <= 7; i++) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() === 1) return d.toISOString().split('T')[0];
    }
    return null;
  }

  // Vrai si la sélection start→end inclut une nuit lundi→mardi
  // (c'est le cas si un lundi d est strictement entre start et end)
  function hasMondayNight(startStr, endStr) {
    const monday = firstMondayAfter(startStr);
    return monday ? monday < endStr : false;
  }

  function buildCalendar() {
    const { currentYear: year, currentMonth: month } = state;
    monthLabel.textContent = `${MONTHS_FR[month]} ${year}`;
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;
    grid.querySelectorAll('.cal-day').forEach(el => el.remove());

    for (let i = 0; i < startDow; i++) {
      const e = document.createElement('div'); e.className = 'cal-day empty'; e.setAttribute('aria-hidden','true'); grid.appendChild(e);
    }

    const rangeEnd = state.endStr || (state.startStr && state.hoverStr > state.startStr ? state.hoverStr : null);

    // Quand une arrivée est sélectionnée : calcule la limite max de départ
    // Le lundi est la dernière date de départ valide (départ lundi matin = OK, mardi = nuit lundi incluse = KO)
    let maxDepartStr = null;
    if (state.startStr && !state.endStr) {
      const maxByNights = addDays(state.startStr, 6);
      const nextMonday  = firstMondayAfter(state.startStr);
      maxDepartStr = nextMonday && nextMonday < maxByNights ? nextMonday : maxByNights;
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = d;
      cell.setAttribute('role', 'gridcell');

      // Après le max de départ (dépasse lundi ou 6 nuits) → invalide comme départ
      const afterMaxDepart = maxDepartStr && ds > maxDepartStr;
      // Lundi futur non réservé : cliquable mais "départ uniquement"
      const isDepartureOnly = isMonday(ds) && ds >= TODAY_STR && !BOOKED_DATES.has(ds) && !state.startStr;

      if (ds < TODAY_STR || BOOKED_DATES.has(ds) || afterMaxDepart) {
        cell.classList.add('disabled');
        cell.setAttribute('aria-disabled', 'true');
      } else if (isDepartureOnly) {
        // Lundi sans arrivée sélectionnée : visible mais indique "départ uniquement"
        cell.classList.add('departure-only');
        cell.setAttribute('tabindex', '0');
        cell.title = 'Départ uniquement — sélectionnez d\'abord votre arrivée';
        cell.addEventListener('click',   () => onDayClick(ds));
        cell.addEventListener('keydown', ev => { if (ev.key==='Enter'||ev.key===' ') { ev.preventDefault(); onDayClick(ds); }});
      } else {
        cell.setAttribute('tabindex', '0');
        cell.addEventListener('click',     () => onDayClick(ds));
        cell.addEventListener('mouseover', () => onDayHover(ds));
        cell.addEventListener('keydown',   ev => { if (ev.key==='Enter'||ev.key===' ') { ev.preventDefault(); onDayClick(ds); }});
      }

      if (ds === TODAY_STR)               cell.classList.add('today');
      if (ds === state.startStr)          cell.classList.add('range-start','selected');
      if (ds === state.endStr)            cell.classList.add('range-end','selected');
      if (state.startStr && rangeEnd && ds > state.startStr && ds < rangeEnd) cell.classList.add('in-range');

      grid.appendChild(cell);
    }
  }

  function onDayClick(ds) {
    if (!state.startStr || state.endStr) {
      if (isMonday(ds)) {
        showToast('Le lundi est réservé aux départs (maintenance). Choisissez d\'abord votre date d\'arrivée.', 'error');
        return;
      }
      state.startStr = ds; state.endStr = null;
    } else if (ds === state.startStr) {
      state.startStr = null;
    } else if (ds < state.startStr) {
      state.startStr = ds; state.endStr = null;
    } else {
      const nuits = daysBetween(state.startStr, ds);
      if (nuits > 6) {
        showToast('Séjour de 7 nuits ou plus : contactez-nous pour une demande exceptionnelle.', 'error');
        return;
      }
      const blocked = firstBlockedAfter(state.startStr);
      if (blocked && blocked < ds) {
        showToast('Des dates sont indisponibles dans cette période.', 'error');
        return;
      }
      if (hasMondayNight(state.startStr, ds)) {
        showToast('La nuit du lundi au mardi est fermée pour raisons de maintenance. Vous pouvez partir le lundi matin. Pour un besoin particulier, <a href="contact.html" style="color:#fff;text-decoration:underline;">contactez-nous</a>.', 'error');
        return;
      }
      state.endStr = ds;
      applyTarifFromSelection();
    }
    state.hoverStr = null;
    buildCalendar(); updateInfo(); updateRecap(); updateSteps();
  }

  function firstBlockedAfter(startStr) {
    // Retourne la première date bloquée strictement après startStr, ou null
    let first = null;
    BOOKED_DATES.forEach(d => {
      if (d > startStr && (!first || d < first)) first = d;
    });
    return first;
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0];
  }

  function onDayHover(ds) {
    if (!state.startStr || state.endStr) return;
    const maxEnd    = addDays(state.startStr, 6);
    const blocked   = firstBlockedAfter(state.startStr);
    const nextMonday = firstMondayAfter(state.startStr);
    // Peut partir au plus tard le lundi (départ lundi matin = OK) mais pas au-delà
    let cap = blocked && blocked < maxEnd ? blocked : maxEnd;
    if (nextMonday && nextMonday < cap) cap = nextMonday;
    const effective = ds > cap ? cap : ds;
    grid.querySelectorAll('.cal-day[data-date]').forEach(cell => {
      const d = cell.dataset.date;
      cell.classList.toggle('in-range', d > state.startStr && d < effective);
    });
  }

  function daysBetween(s1, s2) {
    return Math.round((new Date(s2) - new Date(s1)) / 86400000);
  }

  function applyTarifFromSelection() {
    const nuits = daysBetween(state.startStr, state.endStr);
    state.nuits = nuits;
    const bestType = nuits === 1 ? 'nuit' : nuits === 2 ? 'weekend' : nuits === 3 ? 'long' : (nuits >= 4 && nuits <= 6) ? 'nuit_longue' : nuits >= 7 ? 'semaine' : null;
    document.querySelectorAll('.duree-option').forEach(o => {
      o.classList.toggle('selected', !!bestType && o.dataset.duree === bestType);
    });
  }

  grid.addEventListener('mouseleave', () => {
    if (state.selectedStart && !state.selectedEnd) { state.hoverDate = null; buildCalendar(); }
  });

  prevBtn.addEventListener('click', () => { state.currentMonth--; if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; } buildCalendar(); });
  nextBtn.addEventListener('click', () => { state.currentMonth++; if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; } buildCalendar(); });

  ['heure_arrivee', 'heure_depart'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateRecap);
  });

  function updateInfo() {
    if (!state.startStr) {
      infoEl.textContent = "Cliquez sur votre date d'arrivée.";
    } else if (!state.endStr) {
      infoEl.textContent = `Arrivée : ${state.startStr} — Cliquez sur la date de départ.`;
    } else {
      const n = daysBetween(state.startStr, state.endStr);
      infoEl.textContent = `${state.startStr} → ${state.endStr} — ${n} nuit${n > 1 ? 's' : ''}`;
    }
  }

  // Durée du séjour : informatif uniquement, pas interactif

  function renderExtras(list) {
    const container = document.getElementById('extras-list');
    if (!container) return;
    if (!list || !list.length) {
      container.innerHTML = '<div style="color:rgba(154,150,145,0.4);font-size:0.8rem;padding:1rem 0;">Aucune option disponible pour le moment.</div>';
      return;
    }
    container.innerHTML = list.map(e => `
      <div class="extra-item" data-extra="${e.key}" data-price="${e.prix}" role="checkbox" aria-checked="false" tabindex="0">
        <div class="extra-left">
          <div class="extra-check" aria-hidden="true">
            <svg viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5"/></svg>
          </div>
          <span class="extra-name">${e.nom}</span>
        </div>
        <span class="extra-price">+${e.prix} €</span>
      </div>
    `).join('');
    container.querySelectorAll('.extra-item').forEach(item => {
      item.addEventListener('click', () => {
        const key = item.dataset.extra;
        if (state.extras.has(key)) { state.extras.delete(key); item.classList.remove('selected'); item.setAttribute('aria-checked','false'); }
        else { state.extras.add(key); item.classList.add('selected'); item.setAttribute('aria-checked','true'); }
        updateRecap();
      });
    });
  }

  function prixPourNuits(nuits) {
    if (nuits <= 1)               return PRIX_BASE.nuit              || 350;
    if (nuits === 2)              return PRIX_BASE.weekend            || 665;
    if (nuits === 3)              return PRIX_BASE.long               || 945;
    if (nuits >= 4 && nuits <= 6) return Math.round((PRIX_BASE.nuit_longue || 300) * nuits);
    return 0;
  }

  function calcDiscount(base, extrasTotal) {
    if (!appliedPromo) return 0;
    const subtotal = base + extrasTotal;
    if (appliedPromo.discount_type === 'percent') {
      return Math.round(subtotal * appliedPromo.discount_value / 100);
    }
    return Math.min(appliedPromo.discount_value, subtotal);
  }

  function heureLabel(val) { return val ? val.replace(':', 'h') : '—'; }

  function updateRecap() {
    recapArrivee.textContent = state.startStr ? state.startStr : '—';
    recapDepart.textContent  = state.endStr   ? state.endStr   : '—';
    const recapHA = document.getElementById('recap-heure-arrivee');
    const recapHD = document.getElementById('recap-heure-depart');
    if (recapHA) recapHA.textContent = heureLabel(document.getElementById('heure_arrivee')?.value);
    if (recapHD) recapHD.textContent = heureLabel(document.getElementById('heure_depart')?.value);
    recapDuree.textContent   = `${state.nuits} nuit${state.nuits > 1 ? 's' : ''}`;
    const base = prixPourNuits(state.nuits);
    recapPrixBase.textContent = `${base} €`;
    let extrasTotal = 0;
    recapExtrasContainer.innerHTML = '';
    state.extras.forEach(key => {
      const item = document.querySelector(`.extra-item[data-extra="${key}"]`);
      if (!item) return;
      const price = parseInt(item.dataset.price, 10);
      extrasTotal += price;
      const row = document.createElement('div'); row.className = 'recap-ligne';
      row.innerHTML = `<span class="recap-label" style="font-size:0.68rem;opacity:0.8">${item.querySelector('.extra-name').textContent}</span><span class="recap-value">+${price} €</span>`;
      recapExtrasContainer.appendChild(row);
    });
    const discount = calcDiscount(base, extrasTotal);
    if (recapDiscountContainer) {
      recapDiscountContainer.innerHTML = discount > 0 ? `
        <div class="recap-ligne" style="color:#7ac498;">
          <span class="recap-label" style="font-size:0.68rem;">${appliedPromo.type === 'gift_card' ? 'Carte cadeau' : 'Code promo'} (${appliedPromo.code})</span>
          <span class="recap-value">-${discount} €</span>
        </div>` : '';
    }
    recapTotal.textContent = `${Math.max(0, base + extrasTotal - discount)} €`;
  }

  if (promoBtn) {
    promoBtn.addEventListener('click', async () => {
      const code = promoInput?.value.trim();
      if (!code) return;
      promoBtn.disabled = true;
      promoMsg.style.color = 'var(--argent)';
      promoMsg.textContent = 'Vérification...';
      try {
        const res = await fetch('/api/promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (!res.ok) {
          promoMsg.style.color = '#e05050';
          promoMsg.textContent = data.error || 'Code invalide.';
          appliedPromo = null;
        } else {
          appliedPromo = data;
          promoMsg.style.color = '#7ac498';
          const label = data.discount_type === 'percent' ? `-${data.discount_value}%` : `-${data.discount_value} €`;
          promoMsg.textContent = `Code appliqué : ${label}`;
          promoInput.disabled = true;
          promoBtn.textContent = '✓';
        }
        updateRecap();
      } catch {
        promoMsg.style.color = '#e05050';
        promoMsg.textContent = 'Erreur réseau.';
      }
      promoBtn.disabled = false;
    });
    promoInput?.addEventListener('keydown', e => { if (e.key === 'Enter') promoBtn.click(); });
  }

  function updateSteps() {
    const s2 = document.getElementById('step-2-label');
    const s3 = document.getElementById('step-3-label');
    if (s2) s2.classList.toggle('active', !!state.startStr);
    if (s3) s3.classList.toggle('active', !!state.startStr && !!state.endStr);
  }

  if (recapBtn) {
    recapBtn.addEventListener('click', async () => {
      const prenom = document.getElementById('prenom')?.value.trim();
      const email  = document.getElementById('email')?.value.trim();
      const rgpd   = document.getElementById('rgpdCheck')?.checked;
      const cgv    = document.getElementById('cgvCheck')?.checked;

      if (!state.startStr) return showToast("Sélectionnez une date d'arrivée.", 'error');
      if (!prenom || !email)    return showToast('Renseignez vos coordonnées.', 'error');
      if (!rgpd || !cgv)        return showToast('Acceptez nos conditions.', 'error');

      const base        = prixPourNuits(state.nuits);
      const extrasItems = [...state.extras].map(key => {
        const item = document.querySelector(`.extra-item[data-extra="${key}"]`);
        return { key, nom: item?.querySelector('.extra-name')?.textContent, prix: parseInt(item?.dataset.price || 0) };
      });
      const extrasTotal = extrasItems.reduce((s, e) => s + e.prix, 0);
      const discount    = calcDiscount(base, extrasTotal);

      recapBtn.disabled = true;
      recapBtn.textContent = 'Envoi en cours...';

      try {
        const res = await fetch('/api/reservation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prenom, nom: document.getElementById('nom')?.value.trim(), email,
            telephone:    document.getElementById('telephone')?.value.trim(),
            date_arrivee:  state.startStr,
            date_depart:   state.endStr || state.startStr,
            heure_arrivee: document.getElementById('heure_arrivee')?.value || '17:00',
            heure_depart:  document.getElementById('heure_depart')?.value  || '10:00',
            duree_type: state.duree, extras: extrasItems,
            montant_base: base, montant_extras: extrasTotal,
            montant_remise: discount,
            montant_total: Math.max(0, base + extrasTotal - discount),
            code_promo: appliedPromo?.code || null,
            occasion: document.getElementById('occasion')?.value,
            message:  document.getElementById('message')?.value.trim(),
          })
        });
        if (res.ok) {
          showToast('Demande envoyée ! Nous vous confirmons sous 24h.', 'success');
          recapBtn.textContent = 'Demande envoyée ✓';
        } else {
          const errData = await res.json().catch(() => ({}));
          showToast(`Erreur ${res.status} : ${errData.error || errData.detail || 'inconnue'}`, 'error');
          recapBtn.disabled = false;
          recapBtn.textContent = 'Procéder au paiement';
        }
      } catch (e) {
        showToast(`Erreur réseau : ${e.message}`, 'error');
        recapBtn.disabled = false;
        recapBtn.textContent = 'Procéder au paiement';
      }
    });
  }

  function showToast(msg, type = 'success') {
    if (!toast) return;
    toast.innerHTML = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 5000);
  }

  loadData();
  updateInfo();
  updateRecap();
})();
