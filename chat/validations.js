/* Demandes de validation (issues GitHub « validation ») : cartes dans le chat,
   synchronisées avec le menu Autorisations. La décision (commentaire valider/refuser)
   reste la même ; ce fichier ne change pas la logique de refus. */
(function (g) {
  'use strict';
  function texte(t) {
    return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2018\u2019\u201C\u201D«»"'`]/g, '').trim();
  }
  function estAccordCourt(t) {
    return /^(oui|ouais|ok|okay|daccord|dac|vas-y|valide|valider|validee|approuve|approuver|go|accepte|accepter)[\s.!?]*$/i.test(texte(t));
  }
  function estRefusCourt(t) {
    return /^(non|nan|refuse|refuser|refusee|annule|annuler|nope)[\s.!?]*$/i.test(texte(t));
  }
  function estPaiementValidation(i) {
    var s = String((i && (i.title || '')) || '') + '\n' + String((i && (i.body || '')) || '');
    return /\bpaiement\b|\bpayer\b|\bpayment\b/i.test(s);
  }
  function origineValidation(i) {
    var b = String((i && i.body) || '');
    var t = String((i && i.title) || '');
    var m = /\*\*Demand[ée]e? dans\s*:\*\*\s*#(\d+)/i.exec(b) || /Demand[ée]e? dans\s*:\s*#(\d+)/i.exec(b) || /\(#(\d+)\)\s*$/.exec(t);
    return m ? Number(m[1]) : 0;
  }
  function concerneConv(i, n) {
    n = Number(n || 0);
    if (!n) return false;
    var o = origineValidation(i);
    return o === n;
  }
  function titreValidation(i) {
    return String((i && i.title) || '').replace(/^⏸️?\s*Validation\s*:\s*/i, '').trim();
  }
  function fusionnerTextesTour(liste) {
    var vus = {};
    return (Array.isArray(liste) ? liste : []).map(function (t) { return String(t || '').trim(); }).filter(function (t) {
      if (!t || vus[t]) return false;
      vus[t] = 1;
      return true;
    }).join('\n\n');
  }
  g.FSMValidations = {
    estAccordCourt: estAccordCourt,
    estRefusCourt: estRefusCourt,
    estPaiementValidation: estPaiementValidation,
    origineValidation: origineValidation,
    concerneConv: concerneConv,
    titreValidation: titreValidation,
    fusionnerTextesTour: fusionnerTextesTour
  };
})(typeof window !== 'undefined' ? window : globalThis);
