/* ============================================================
   LOFT DELICIAE — Réservation (connecté à Supabase)
   ============================================================ */

(function () {
  'use strict';

  let PRIX_BASE   = { nuit: 180, weekend: 320, long: 450, semaine: 980 };
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
        if (opt) opt.querySelector('.duree-option-price').textContent = `à partir de ${t.prix} €`;
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
    selectedStart: null, selectedEnd: null, hoverDate: null,
    duree: 'nuit', nuits: 1, extras: new Set(),
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

  function buildCalendar() {
    const { currentYear: year, currentMonth: month } = state;
    monthLabel.textContent = `${MONTHS_FR[month]} ${year}`;
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;
    grid.querySelectorAll('.cal-day').forEach(el => el.remove());

    for (let i = 0; i < startDow; i++) {
      const e = document.createElement('div');
      e.className = 'cal-day empty';
      e.setAttribute('aria-hidden', 'true');
      grid.appendChild(e);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d); date.setHours(0,0,0,0);
      const dateStr  = formatDate(date);
      const isPast   = date < TODAY;
      const isBooked = BOOKED_DATES.has(dateStr);
      const isToday  = date.getTime() === TODAY.getTime();
      const isStart  = state.selectedStart && formatDate(state.selectedStart) === dateStr;
      const isEnd    = state.selectedEnd   && formatDate(state.selectedEnd)   === dateStr;

      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = d;
      cell.dataset.date = dateStr;
      cell.setAttribute('role', 'gridcell');

      if (isPast || isBooked) {
        cell.classList.add('disabled');
        cell.setAttribute('aria-disabled', 'true');
      } else {
        cell.setAttribute('tabindex', '0');
        cell.addEventListener('click',     () => onDayClick(date));
        cell.addEventListener('mouseover', () => onDayHover(date));
        cell.addEventListener('keydown',   ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onDayClick(date); } });
      }

      if (isToday) cell.classList.add('today');
      if (isStart) cell.classList.add('range-start', 'selected');
      if (isEnd)   cell.classList.add('range-end',   'selected');
      if ((state.selectedStart && state.selectedEnd && date > state.selectedStart && date < state.selectedEnd) ||
          (state.selectedStart && !state.selectedEnd && state.hoverDate && date > Math.min(state.selectedStart, state.hoverDate) && date < Math.max(state.selectedStart, state.hoverDate))) {
        cell.classList.add('in-range');
      }

      grid.appendChild(cell);
    }
  }

  function onDayClick(date) {
    if (!state.selectedStart || (state.selectedStart && state.selectedEnd)) {
      state.selectedStart = date; state.selectedEnd = null;
    } else {
      if (date <= state.selectedStart) { state.selectedStart = date; state.selectedEnd = null; }
      else { state.selectedEnd = date; }
    }
    state.hoverDate = null;
    if (state.selectedStart && state.selectedEnd) applyTarifFromSelection();
    buildCalendar(); updateInfo(); updateRecap(); updateSteps();
  }

  function onDayHover(date) {
    if (state.selectedStart && !state.selectedEnd) { state.hoverDate = date; buildCalendar(); }
  }

  function applyTarifFromSelection() {
    const nuits = Math.round((state.selectedEnd - state.selectedStart) / 86400000);
    state.nuits = nuits;
    // Surligner la ligne tarifaire correspondante
    const bestType = nuits <= 1 ? 'nuit' : nuits === 2 ? 'weekend' : nuits === 3 ? 'long' : nuits >= 7 ? 'semaine' : null;
    document.querySelectorAll('.duree-option').forEach(o => {
      o.classList.toggle('selected', bestType ? o.dataset.duree === bestType : false);
    });
    state.duree = bestType || 'custom';
  }

  grid.addEventListener('mouseleave', () => {
    if (state.selectedStart && !state.selectedEnd) { state.hoverDate = null; buildCalendar(); }
  });

  prevBtn.addEventListener('click', () => { state.currentMonth--; if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; } buildCalendar(); });
  nextBtn.addEventListener('click', () => { state.currentMonth++; if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; } buildCalendar(); });

  function updateInfo() {
    if (!state.selectedStart) { infoEl.textContent = "Sélectionnez votre date d'arrivée."; }
    else if (!state.selectedEnd) { infoEl.textContent = `Arrivée le ${formatDateFR(state.selectedStart)} — Sélectionnez la date de départ.`; }
    else {
      const n = Math.round((state.selectedEnd - state.selectedStart) / 86400000);
      infoEl.textContent = `${formatDateFR(state.selectedStart)} → ${formatDateFR(state.selectedEnd)} — ${n} nuit${n > 1 ? 's' : ''}`;
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
    if (nuits <= 1)  return PRIX_BASE.nuit     || 180;
    if (nuits === 2) return PRIX_BASE.weekend  || 320;
    if (nuits === 3) return PRIX_BASE.long     || 450;
    if (nuits >= 7)  return PRIX_BASE.semaine  || 980;
    // 4, 5, 6 nuits : interpolation au prorata nuitée
    const tauxNuit = (PRIX_BASE.nuit || 180);
    return Math.round(tauxNuit * nuits);
  }

  function calcDiscount(base, extrasTotal) {
    if (!appliedPromo) return 0;
    const subtotal = base + extrasTotal;
    if (appliedPromo.discount_type === 'percent') {
      return Math.round(subtotal * appliedPromo.discount_value / 100);
    }
    return Math.min(appliedPromo.discount_value, subtotal);
  }

  function updateRecap() {
    recapArrivee.textContent = state.selectedStart ? formatDateFR(state.selectedStart) : '—';
    recapDepart.textContent  = state.selectedEnd   ? formatDateFR(state.selectedEnd)   : '—';
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
    if (s2) s2.classList.toggle('active', !!state.selectedStart);
    if (s3) s3.classList.toggle('active', !!state.selectedStart && !!state.selectedEnd);
  }

  if (recapBtn) {
    recapBtn.addEventListener('click', async () => {
      const prenom = document.getElementById('prenom')?.value.trim();
      const email  = document.getElementById('email')?.value.trim();
      const rgpd   = document.getElementById('rgpdCheck')?.checked;
      const cgv    = document.getElementById('cgvCheck')?.checked;

      if (!state.selectedStart) return showToast("Sélectionnez une date d'arrivée.", 'error');
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
            date_arrivee: formatDate(state.selectedStart),
            date_depart:  state.selectedEnd ? formatDate(state.selectedEnd) : formatDate(state.selectedStart),
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
        } else throw new Error();
      } catch {
        showToast("Erreur lors de l'envoi. Réessayez.", 'error');
        recapBtn.disabled = false;
        recapBtn.textContent = 'Procéder au paiement';
      }
    });
  }

  function showToast(msg, type = 'success') {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 5000);
  }

  loadData();
  updateInfo();
  updateRecap();
})();
