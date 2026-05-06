/* ============================================================
   LOFT DELICIAE — Système de réservation
   Calendrier · Sélection dates · Extras · Récapitulatif
   ============================================================ */

(function () {
  'use strict';

  /* ── Prix de base par durée ──────────────────────────────── */
  const PRIX_BASE = {
    nuit:    180,
    weekend: 320,
    long:    450,
    semaine: 980,
  };

  /* Dates indisponibles simulées (format YYYY-MM-DD) */
  const BOOKED_DATES = generateBookedDates();

  function generateBookedDates() {
    const booked = new Set();
    const now = new Date();
    const pairs = [
      [3, 4], [3, 5], [3, 6],
      [10, 11], [10, 12],
      [17, 18],
      [24, 25], [24, 26], [24, 27],
    ];
    pairs.forEach(([start, end]) => {
      for (let d = start; d <= end; d++) {
        const date = new Date(now.getFullYear(), now.getMonth(), d);
        booked.add(formatDate(date));
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, d);
        booked.add(formatDate(nextMonth));
      }
    });
    return booked;
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDateFR(date) {
    if (!date) return '—';
    return date.toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
    });
  }

  /* ── État ───────────────────────────────────────────────── */
  const state = {
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    selectedStart: null,
    selectedEnd: null,
    hoverDate: null,
    duree: 'nuit',
    nuits: 1,
    extras: new Set(),
  };

  /* ── DOM ────────────────────────────────────────────────── */
  const grid = document.getElementById('calendarGrid');
  const monthLabel = document.getElementById('calMonthLabel');
  const prevBtn = document.getElementById('calPrev');
  const nextBtn = document.getElementById('calNext');
  const infoEl = document.getElementById('dateSelectionInfo');

  const recapArrivee = document.getElementById('recap-arrivee');
  const recapDepart = document.getElementById('recap-depart');
  const recapDuree = document.getElementById('recap-duree');
  const recapPrixBase = document.getElementById('recap-prix-base');
  const recapExtrasContainer = document.getElementById('recap-extras-container');
  const recapTotal = document.getElementById('recap-total');
  const recapBtn = document.getElementById('recapBtn');
  const toast = document.getElementById('toast');

  if (!grid) return;

  /* ── Calendrier ─────────────────────────────────────────── */
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);

  function buildCalendar() {
    const year = state.currentYear;
    const month = state.currentMonth;

    monthLabel.textContent = `${MONTHS_FR[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    const startDow = (firstDay.getDay() + 6) % 7;

    const existingDays = grid.querySelectorAll('.cal-day');
    existingDays.forEach(el => el.remove());

    for (let i = 0; i < startDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      empty.setAttribute('aria-hidden', 'true');
      grid.appendChild(empty);
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      date.setHours(0, 0, 0, 0);
      const dateStr = formatDate(date);

      const cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = d;
      cell.dataset.date = dateStr;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

      const isPast    = date < TODAY;
      const isBooked  = BOOKED_DATES.has(dateStr);
      const isToday   = date.getTime() === TODAY.getTime();
      const isStart   = state.selectedStart && formatDate(state.selectedStart) === dateStr;
      const isEnd     = state.selectedEnd   && formatDate(state.selectedEnd)   === dateStr;
      const inRange   = isInRange(date);
      const inHover   = isInHoverRange(date);

      if (isPast || isBooked) {
        cell.classList.add('disabled');
        cell.setAttribute('aria-disabled', 'true');
      } else {
        cell.setAttribute('tabindex', '0');
        cell.addEventListener('click', () => onDayClick(date));
        cell.addEventListener('mouseover', () => onDayHover(date));
        cell.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDayClick(date); }
        });
      }

      if (isToday) cell.classList.add('today');
      if (isStart) cell.classList.add('range-start', 'selected');
      if (isEnd)   cell.classList.add('range-end', 'selected');
      if (inRange || inHover) cell.classList.add('in-range');

      grid.appendChild(cell);
    }
  }

  function isInRange(date) {
    if (!state.selectedStart || !state.selectedEnd) return false;
    return date > state.selectedStart && date < state.selectedEnd;
  }

  function isInHoverRange(date) {
    if (!state.selectedStart || state.selectedEnd || !state.hoverDate) return false;
    const min = state.selectedStart < state.hoverDate ? state.selectedStart : state.hoverDate;
    const max = state.selectedStart < state.hoverDate ? state.hoverDate : state.selectedStart;
    return date > min && date < max;
  }

  function onDayClick(date) {
    if (!state.selectedStart || (state.selectedStart && state.selectedEnd)) {
      state.selectedStart = date;
      state.selectedEnd = null;
    } else {
      if (date < state.selectedStart) {
        state.selectedEnd = state.selectedStart;
        state.selectedStart = date;
      } else if (date.getTime() === state.selectedStart.getTime()) {
        state.selectedStart = null;
      } else {
        state.selectedEnd = date;
      }
    }
    state.hoverDate = null;
    buildCalendar();
    updateInfo();
    updateRecap();
    updateStepIndicators();
  }

  function onDayHover(date) {
    if (state.selectedStart && !state.selectedEnd) {
      state.hoverDate = date;
      buildCalendar();
    }
  }

  grid.addEventListener('mouseleave', () => {
    if (state.selectedStart && !state.selectedEnd) {
      state.hoverDate = null;
      buildCalendar();
    }
  });

  prevBtn.addEventListener('click', () => {
    state.currentMonth--;
    if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
    buildCalendar();
  });

  nextBtn.addEventListener('click', () => {
    state.currentMonth++;
    if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
    buildCalendar();
  });

  function updateInfo() {
    if (!state.selectedStart) {
      infoEl.textContent = 'Sélectionnez votre date d\'arrivée.';
    } else if (!state.selectedEnd) {
      infoEl.textContent = `Arrivée le ${formatDateFR(state.selectedStart)} — Sélectionnez maintenant la date de départ.`;
    } else {
      const nights = Math.round((state.selectedEnd - state.selectedStart) / 86400000);
      infoEl.textContent = `${formatDateFR(state.selectedStart)} → ${formatDateFR(state.selectedEnd)} — ${nights} nuit${nights > 1 ? 's' : ''}`;
    }
  }

  /* ── Durée ──────────────────────────────────────────────── */
  const dureeOptions = document.querySelectorAll('.duree-option');
  dureeOptions.forEach(opt => {
    opt.addEventListener('click', () => selectDuree(opt));
    opt.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDuree(opt); }
    });
  });

  function selectDuree(opt) {
    dureeOptions.forEach(o => { o.classList.remove('selected'); o.setAttribute('aria-checked', 'false'); });
    opt.classList.add('selected');
    opt.setAttribute('aria-checked', 'true');
    state.duree = opt.dataset.duree;
    state.nuits = parseInt(opt.dataset.nuits, 10);
    updateRecap();
    updateStepIndicators();
  }

  /* ── Extras ─────────────────────────────────────────────── */
  const extraItems = document.querySelectorAll('.extra-item');
  extraItems.forEach(item => {
    item.addEventListener('click', () => toggleExtra(item));
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExtra(item); }
    });
  });

  function toggleExtra(item) {
    const key = item.dataset.extra;
    if (state.extras.has(key)) {
      state.extras.delete(key);
      item.classList.remove('selected');
      item.setAttribute('aria-checked', 'false');
    } else {
      state.extras.add(key);
      item.classList.add('selected');
      item.setAttribute('aria-checked', 'true');
    }
    updateRecap();
  }

  /* ── Récapitulatif ──────────────────────────────────────── */
  function updateRecap() {
    recapArrivee.textContent = state.selectedStart ? formatDateFR(state.selectedStart) : '—';
    recapDepart.textContent  = state.selectedEnd   ? formatDateFR(state.selectedEnd)   : '—';

    const nuits = state.nuits;
    recapDuree.textContent = `${nuits} nuit${nuits > 1 ? 's' : ''}`;

    const base = PRIX_BASE[state.duree] || 180;
    recapPrixBase.textContent = `${base} €`;

    let extrasTotal = 0;
    recapExtrasContainer.innerHTML = '';
    state.extras.forEach(key => {
      const item = document.querySelector(`.extra-item[data-extra="${key}"]`);
      if (!item) return;
      const price = parseInt(item.dataset.price, 10);
      extrasTotal += price;
      const name = item.querySelector('.extra-name').textContent;
      const row = document.createElement('div');
      row.className = 'recap-ligne';
      row.innerHTML = `<span class="recap-label" style="font-size:0.68rem;opacity:0.8;">${name}</span><span class="recap-value">+${price} €</span>`;
      recapExtrasContainer.appendChild(row);
    });

    const total = base + extrasTotal;
    recapTotal.textContent = `${total} €`;
  }

  /* ── Indicateurs d'étapes ───────────────────────────────── */
  function updateStepIndicators() {
    const step1 = document.getElementById('step-1-label');
    const step2 = document.getElementById('step-2-label');
    const step3 = document.getElementById('step-3-label');

    if (step1) step1.classList.toggle('active', true);
    if (step2) step2.classList.toggle('active', !!state.selectedStart);
    if (step3) step3.classList.toggle('active', !!state.selectedStart && !!state.selectedEnd);
  }

  /* ── Bouton paiement ────────────────────────────────────── */
  if (recapBtn) {
    recapBtn.addEventListener('click', () => {
      const form = document.getElementById('reservationForm');
      const prenom = document.getElementById('prenom')?.value.trim();
      const email  = document.getElementById('email')?.value.trim();
      const rgpd   = document.getElementById('rgpdCheck')?.checked;
      const cgv    = document.getElementById('cgvCheck')?.checked;

      if (!state.selectedStart) {
        showToast('Veuillez sélectionner une date d\'arrivée.', 'error');
        return;
      }
      if (!prenom || !email) {
        showToast('Veuillez renseigner vos coordonnées.', 'error');
        return;
      }
      if (!rgpd || !cgv) {
        showToast('Veuillez accepter nos conditions et politique de confidentialité.', 'error');
        return;
      }

      showToast('Redirection vers le paiement sécurisé Stripe...', 'success');

      /* Ici : intégration Stripe Checkout via votre backend */
      /* Exemple : window.location.href = '/create-checkout-session'; */
    });
  }

  function showToast(message, type = 'success') {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 5000);
  }

  /* ── Init ───────────────────────────────────────────────── */
  buildCalendar();
  updateInfo();
  updateRecap();

})();
