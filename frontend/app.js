// TRIBE — vanilla JS single-page app, zero build step.
"use strict";

const API = ""; // same origin as the backend serving this file
const $app = document.getElementById("app");
const PREMIUM_PRICE = 4.99;

// ================= i18n =================
// Zero-dependency translation layer: everything a user sees is looked up
// from STRINGS[currentLang][key], with a fallback to German if a key is
// somehow missing in the active language. Language is auto-detected from
// the browser once, then remembered in localStorage; a manual switcher
// (topbar globe icon + Auth screen + Profile) lets anyone override it.
const LANG_STORAGE_KEY = "tribe_lang";
const SUPPORTED_LANGS = ["de", "en", "pt"];
const LANG_LABELS = { de: "Deutsch", en: "English", pt: "Português" };

function detectLanguage() {
  const saved = localStorage.getItem(LANG_STORAGE_KEY);
  if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  const nav = (navigator.language || navigator.userLanguage || "de").toLowerCase();
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("en")) return "en";
  return "de";
}

let currentLang = detectLanguage();
document.documentElement.lang = currentLang;

function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang) || lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem(LANG_STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  render();
}

function t(key, vars) {
  const dict = STRINGS[currentLang] || STRINGS.de;
  let str = dict[key] ?? STRINGS.de[key] ?? key;
  if (vars) {
    for (const k in vars) str = str.split(`{${k}}`).join(vars[k]);
  }
  return str;
}

// Backend responses may include a stable `code` alongside the (German)
// `error` text. If we recognize the code, show a localized message;
// otherwise fall back to whatever the backend sent.
function errMsg(err) {
  const dict = ERROR_STRINGS[currentLang] || ERROR_STRINGS.de;
  if (err && err.code && dict[err.code]) return dict[err.code];
  return (err && err.message) || t("generic_error");
}

function openLanguageSheet() {
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  overlay.innerHTML = `
    <div class="sheet-box">
      <h3>${t("language_picker_title")}</h3>
      ${SUPPORTED_LANGS.map(
        (l) =>
          `<button type="button" class="btn-secondary lang-option" data-lang="${l}" style="${
            l === currentLang ? "border-color:var(--accent2);" : ""
          }">${LANG_LABELS[l]}${l === currentLang ? " ✓" : ""}</button>`
      ).join("")}
      <button class="btn-ghost" id="lang-cancel-btn">${t("cancel")}</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#lang-cancel-btn").onclick = () => overlay.remove();
  overlay.querySelectorAll(".lang-option").forEach((btn) => {
    btn.onclick = () => {
      overlay.remove();
      setLanguage(btn.dataset.lang);
    };
  });
}

// Picked once per page load, so the tagline changes on every reload.
const TAGLINES = {
  de: [
    "Finde Leute, die dasselbe suchen wie du.",
    "Finde Leute aus deiner Bubble.",
    "Finde Leute, die du sonst nirgends triffst.",
  ],
  en: [
    "Find people who want the same thing as you.",
    "Find people from your bubble.",
    "Find people you'd never meet otherwise.",
  ],
  pt: [
    "Encontre pessoas que buscam o mesmo que você.",
    "Encontre pessoas da sua bolha.",
    "Encontre pessoas que você nunca encontraria de outra forma.",
  ],
};
function pickTagline() {
  const arr = TAGLINES[currentLang] || TAGLINES.de;
  return arr[Math.floor(Math.random() * arr.length)];
}
const TAGLINE = pickTagline();

const MONTH_NAMES = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  pt: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
};

const STRINGS = {
  de: {
    generic_error: "Etwas ist schiefgelaufen",
    cancel: "Abbrechen",
    language_picker_title: "Sprache wählen",
    install_button: "📲 App installieren",
    install_inapp_alert:
      "Du hast den Link in einem In-App-Browser geöffnet (z.B. WhatsApp/Instagram) — von dort geht die Installation leider nicht.\n\nTippe oben rechts auf 'Weitere Optionen' bzw. die drei Punkte und wähle 'Im Browser öffnen' (Chrome/Safari). Danach kannst du TRIBE ganz normal installieren.",
    install_ios_alert:
      "So installierst du TRIBE auf dem iPhone:\n\n1. Tippe unten auf das Teilen-Symbol (Quadrat mit Pfeil nach oben)\n2. Wähle 'Zum Home-Bildschirm'\n3. Tippe auf 'Hinzufügen'",
    install_generic_alert:
      "Öffne das Menü deines Browsers (meist drei Punkte oben rechts) und wähle 'App installieren' oder 'Zum Startbildschirm hinzufügen'.",
    login_tab: "Login",
    register_tab: "Registrieren",
    beta_notice_1:
      "🚧 TRIBE steckt noch in einer frühen Phase. Es kann zu Bugs oder Änderungen kommen, und wir bringen laufend Updates. Vorschläge und Feedback sind jederzeit herzlich willkommen unter",
    beta_notice_2:
      "🌱 TRIBE ist gerade erst gestartet, deshalb sind aktuell noch nicht viele Leute angemeldet. Hol dir die App trotzdem schon jetzt und hab ein bisschen Geduld — je mehr Leute dabei sind, desto mehr Matches gibt's auch für dich.",
    beta_notice_profile:
      "🚧 TRIBE ist noch am Anfang — es kann zu Bugs oder Änderungen kommen, und es gibt laufend Updates. Vorschläge und Feedback sind jederzeit herzlich willkommen unter",
    email_label: "E-Mail",
    password_label: "Passwort",
    login_submit: "Einloggen",
    name_label: "Name",
    birthdate_label: "Geburtsdatum (du musst 18+ sein)",
    day_placeholder: "Tag",
    month_placeholder: "Monat",
    year_placeholder: "Jahr",
    location_label: "Stadt / Region / Land",
    location_placeholder: "z.B. Wien, Österreich",
    identity_label: "Wie präsentierst / identifizierst du dich? (mehrere möglich)",
    seeking_label: "Wonach suchst du?",
    age_range_label: "Altersspanne, die du sehen willst",
    to_separator: " bis ",
    register_submit: "Account erstellen",
    consent_text_prefix: "Mit der Registrierung akzeptierst du unsere",
    privacy_link: "Datenschutzerklärung",
    and_text: "und unsere",
    child_safety_link: "Kinderschutzrichtlinie",
    consent_age_text: "Du musst mindestens 18 Jahre alt sein.",
    advertise_prompt: "Du willst deine Marke bei uns bewerben?",
    advertise_link: "Werbung auf TRIBE schalten",
    group_gender: "Geschlecht / Identität",
    group_orientation: "Sexuelle Orientierung",
    group_style: "Style / Szene",
    all_genders_chip: "🌈 Alle Geschlechter / alles gemixt",
    logout_button: "Abmelden",
    install_title_attr: "App installieren",
    nav_discover: "Entdecken",
    nav_matches: "Matches",
    nav_profile: "Profil",
    premium_banner_text: "Werbefrei mit TRIBE Premium – {price} €/Monat",
    view_button: "Ansehen",
    empty_discover_title: "Keine neuen Leute gerade",
    empty_discover_text1: "Schau später nochmal vorbei oder passe deine Kategorien im Profil an.",
    empty_discover_text2:
      "TRIBE ist noch ganz neu, deshalb sind aktuell erst wenige Leute angemeldet. Bleib dran — je mehr Leute sich anmelden, desto mehr Matches gibt's auch für dich. Erzähl gern auch Freund:innen aus deiner Szene davon! 🌱",
    undo_button_empty: "↺ Letzten Swipe rückgängig machen",
    reload_button: "Neu laden",
    undo_title_attr: "Letzten Swipe rückgängig machen",
    ad_continue_button: "Weiter →",
    ad_cta_fallback: "Mehr erfahren",
    ad_tag_label: "Anzeige",
    card_menu_title: "Melden oder blockieren",
    undo_alert_generic_prefix: "Rückgängig machen hat nicht geklappt: ",
    match_title: "MATCH!",
    match_text: "Du und {name} habt euch gematcht.",
    say_hi_button: "Schreib was",
    keep_swiping_button: "Weiterswipen",
    report_button: "🚩 Melden",
    block_button: "🚫 Blockieren",
    block_confirm: "{name} wirklich blockieren? Ihr seht euch danach gegenseitig nicht mehr.",
    default_person_label: "Nutzer:in",
    report_form_title: "{name} melden",
    reason_label: "Grund",
    additional_info_label: "Zusätzliche Infos (optional)",
    send_report_button: "Meldung senden",
    back_button: "Zurück",
    report_success: "Danke, deine Meldung wurde gesendet ✓",
    close_button: "Schließen",
    no_matches_title: "Noch keine Matches",
    no_matches_text: "Geh zu \"Entdecken\" und finde deine Leute.",
    match_search_placeholder: "Nach Namen suchen…",
    no_matches_found: "Keine Matches mit diesem Namen gefunden.",
    say_hello_default: "Sag Hallo 👋",
    chat_loading: "Lädt…",
    chat_input_placeholder: "Nachricht…",
    send_button: "Senden",
    photo_sheet_title: "Profilfoto",
    take_photo_button: "📷 Foto aufnehmen",
    choose_photo_button: "🖼️ Aus Galerie wählen",
    bio_label: "Bio",
    how_you_present_heading: "Wie du dich präsentierst",
    what_you_seek_heading: "Wonach du suchst",
    open_to_new_button: "🌈 Offen für Neues",
    open_to_new_text:
      "Noch unsicher, was dir gefällt? Aktivier das, damit dir beim Entdecken auch Leute außerhalb deiner Auswahl oben gezeigt werden — zum Ausprobieren.",
    save_button: "Speichern",
    blocked_users_heading: "Blockierte Nutzer:innen",
    help_support_heading: "Hilfe & Support",
    language_heading: "Sprache",
    delete_account_heading: "Account löschen",
    delete_account_desc:
      "Löscht deinen Account, dein Profil, deine Matches, Chats und Swipes unwiderruflich. Ein laufendes Premium-Abo wird dabei automatisch gekündigt.",
    delete_account_button: "🗑️ Account endgültig löschen",
    delete_confirm_prompt:
      'Das kann nicht rückgängig gemacht werden. Tippe zur Bestätigung "LÖSCHEN" (in Großbuchstaben) und bestätige.',
    delete_confirm_word: "LÖSCHEN",
    delete_success_alert: "Dein Account wurde gelöscht.",
    saved_success: "Gespeichert ✓",
    premium_active_label: "✓ TRIBE Premium aktiv",
    premium_active_until: "Werbefrei bis {date}",
    demo_suffix: " (Demo, kein echtes Geld)",
    cancel_premium_button: "Kündigen",
    premium_heading: "TRIBE Premium",
    premium_price_text: "Werbefrei, {price} €/Monat",
    upgrade_button: "Upgraden",
    no_blocked_users: "Du hast niemanden blockiert.",
    unblock_button: "Entblocken",
    blocked_load_error: "Blockierte Nutzer konnten nicht geladen werden.",
    support_subject_placeholder: "Betreff",
    support_message_placeholder: "Wie können wir helfen?",
    send_ticket_button: "Ticket senden",
    ticket_sent_success: "Ticket gesendet ✓ – wir melden uns per E-Mail.",
    your_tickets_heading: "Deine Tickets",
    status_open: "offen",
    status_closed: "geschlossen",
    reply_prefix: "Antwort: {reply}",
    backend_unreachable: "Backend nicht erreichbar. Läuft der Server?",
  },
  en: {
    generic_error: "Something went wrong",
    cancel: "Cancel",
    language_picker_title: "Choose language",
    install_button: "📲 Install app",
    install_inapp_alert:
      "You opened this link inside an in-app browser (e.g. WhatsApp/Instagram) — installing from there unfortunately doesn't work.\n\nTap the \"⋮\" or three dots in the top right and choose \"Open in browser\" (Chrome/Safari). Then you can install TRIBE normally.",
    install_ios_alert:
      "Here's how to install TRIBE on iPhone:\n\n1. Tap the share icon at the bottom (square with an arrow pointing up)\n2. Choose \"Add to Home Screen\"\n3. Tap \"Add\"",
    install_generic_alert:
      "Open your browser's menu (usually three dots in the top right) and choose \"Install app\" or \"Add to Home screen\".",
    login_tab: "Log in",
    register_tab: "Sign up",
    beta_notice_1:
      "🚧 TRIBE is still in an early phase. There may be bugs or changes, and we're rolling out updates continuously. Suggestions and feedback are always welcome at",
    beta_notice_2:
      "🌱 TRIBE just launched, so there aren't many people signed up yet. Get the app now anyway and have a little patience — the more people join, the more matches you'll get too.",
    beta_notice_profile:
      "🚧 TRIBE is still just getting started — there may be bugs or changes, and updates keep coming. Suggestions and feedback are always welcome at",
    email_label: "Email",
    password_label: "Password",
    login_submit: "Log in",
    name_label: "Name",
    birthdate_label: "Date of birth (you must be 18+)",
    day_placeholder: "Day",
    month_placeholder: "Month",
    year_placeholder: "Year",
    location_label: "City / Region / Country",
    location_placeholder: "e.g. Vienna, Austria",
    identity_label: "How do you present / identify? (multiple possible)",
    seeking_label: "What are you looking for?",
    age_range_label: "Age range you want to see",
    to_separator: " to ",
    register_submit: "Create account",
    consent_text_prefix: "By signing up you accept our",
    privacy_link: "Privacy Policy",
    and_text: "and our",
    child_safety_link: "Child Safety Policy",
    consent_age_text: "You must be at least 18 years old.",
    advertise_prompt: "Want to advertise your brand with us?",
    advertise_link: "Advertise on TRIBE",
    group_gender: "Gender / Identity",
    group_orientation: "Sexual Orientation",
    group_style: "Style / Scene",
    all_genders_chip: "🌈 All genders / open to anyone",
    logout_button: "Log out",
    install_title_attr: "Install app",
    nav_discover: "Discover",
    nav_matches: "Matches",
    nav_profile: "Profile",
    premium_banner_text: "Ad-free with TRIBE Premium – {price} €/month",
    view_button: "View",
    empty_discover_title: "No new people right now",
    empty_discover_text1: "Check back later or adjust your categories in your profile.",
    empty_discover_text2:
      "TRIBE is brand new, so only a few people have signed up so far. Stick around — the more people join, the more matches you'll get too. Feel free to tell friends from your scene about it! 🌱",
    undo_button_empty: "↺ Undo last swipe",
    reload_button: "Reload",
    undo_title_attr: "Undo last swipe",
    ad_continue_button: "Continue →",
    ad_cta_fallback: "Learn more",
    ad_tag_label: "Ad",
    card_menu_title: "Report or block",
    undo_alert_generic_prefix: "Undo failed: ",
    match_title: "MATCH!",
    match_text: "You and {name} matched.",
    say_hi_button: "Say hi",
    keep_swiping_button: "Keep swiping",
    report_button: "🚩 Report",
    block_button: "🚫 Block",
    block_confirm: "Really block {name}? You won't see each other anymore.",
    default_person_label: "User",
    report_form_title: "Report {name}",
    reason_label: "Reason",
    additional_info_label: "Additional info (optional)",
    send_report_button: "Send report",
    back_button: "Back",
    report_success: "Thanks, your report was sent ✓",
    close_button: "Close",
    no_matches_title: "No matches yet",
    no_matches_text: 'Go to "Discover" and find your people.',
    match_search_placeholder: "Search by name…",
    no_matches_found: "No matches found with that name.",
    say_hello_default: "Say hello 👋",
    chat_loading: "Loading…",
    chat_input_placeholder: "Message…",
    send_button: "Send",
    photo_sheet_title: "Profile photo",
    take_photo_button: "📷 Take photo",
    choose_photo_button: "🖼️ Choose from gallery",
    bio_label: "Bio",
    how_you_present_heading: "How you present yourself",
    what_you_seek_heading: "What you're looking for",
    open_to_new_button: "🌈 Open to new things",
    open_to_new_text:
      "Still not sure what you're into? Turn this on so Discover also shows you people outside your selection above — to try it out.",
    save_button: "Save",
    blocked_users_heading: "Blocked users",
    help_support_heading: "Help & Support",
    language_heading: "Language",
    delete_account_heading: "Delete account",
    delete_account_desc:
      "Permanently deletes your account, profile, matches, chats and swipes. An active Premium subscription will be cancelled automatically.",
    delete_account_button: "🗑️ Permanently delete account",
    delete_confirm_prompt: 'This cannot be undone. Type "DELETE" (all caps) to confirm.',
    delete_confirm_word: "DELETE",
    delete_success_alert: "Your account has been deleted.",
    saved_success: "Saved ✓",
    premium_active_label: "✓ TRIBE Premium active",
    premium_active_until: "Ad-free until {date}",
    demo_suffix: " (Demo, no real money)",
    cancel_premium_button: "Cancel",
    premium_heading: "TRIBE Premium",
    premium_price_text: "Ad-free, {price} €/month",
    upgrade_button: "Upgrade",
    no_blocked_users: "You haven't blocked anyone.",
    unblock_button: "Unblock",
    blocked_load_error: "Couldn't load blocked users.",
    support_subject_placeholder: "Subject",
    support_message_placeholder: "How can we help?",
    send_ticket_button: "Send ticket",
    ticket_sent_success: "Ticket sent ✓ – we'll get back to you by email.",
    your_tickets_heading: "Your tickets",
    status_open: "open",
    status_closed: "closed",
    reply_prefix: "Reply: {reply}",
    backend_unreachable: "Backend unreachable. Is the server running?",
  },
  pt: {
    generic_error: "Algo deu errado",
    cancel: "Cancelar",
    language_picker_title: "Escolher idioma",
    install_button: "📲 Instalar app",
    install_inapp_alert:
      "Você abriu esse link dentro de um navegador interno de outro app (ex.: WhatsApp/Instagram) — infelizmente não dá pra instalar por lá.\n\nToque em \"⋮\" ou nos três pontinhos no canto superior direito e escolha \"Abrir no navegador\" (Chrome/Safari). Depois você pode instalar o TRIBE normalmente.",
    install_ios_alert:
      "Veja como instalar o TRIBE no iPhone:\n\n1. Toque no ícone de compartilhar embaixo (quadrado com seta para cima)\n2. Escolha \"Adicionar à Tela de Início\"\n3. Toque em \"Adicionar\"",
    install_generic_alert:
      "Abra o menu do seu navegador (geralmente três pontinhos no canto superior direito) e escolha \"Instalar app\" ou \"Adicionar à tela inicial\".",
    login_tab: "Entrar",
    register_tab: "Registrar",
    beta_notice_1:
      "🚧 O TRIBE ainda está em uma fase inicial. Pode haver bugs ou mudanças, e estamos lançando atualizações o tempo todo. Sugestões e feedback são sempre bem-vindos em",
    beta_notice_2:
      "🌱 O TRIBE acabou de ser lançado, então ainda não tem muita gente cadastrada. Baixe o app agora mesmo e tenha um pouco de paciência — quanto mais gente entrar, mais matches você também vai ter.",
    beta_notice_profile:
      "🚧 O TRIBE ainda está começando — pode haver bugs ou mudanças, e atualizações continuam chegando. Sugestões e feedback são sempre bem-vindos em",
    email_label: "Email",
    password_label: "Senha",
    login_submit: "Entrar",
    name_label: "Nome",
    birthdate_label: "Data de nascimento (você precisa ter 18+)",
    day_placeholder: "Dia",
    month_placeholder: "Mês",
    year_placeholder: "Ano",
    location_label: "Cidade / Região / País",
    location_placeholder: "ex.: São Paulo, Brasil",
    identity_label: "Como você se apresenta / identifica? (pode escolher várias)",
    seeking_label: "O que você está procurando?",
    age_range_label: "Faixa etária que você quer ver",
    to_separator: " a ",
    register_submit: "Criar conta",
    consent_text_prefix: "Ao se registrar, você aceita nossa",
    privacy_link: "Política de Privacidade",
    and_text: "e nossa",
    child_safety_link: "Política de Proteção Infantil",
    consent_age_text: "Você precisa ter pelo menos 18 anos.",
    advertise_prompt: "Quer anunciar sua marca aqui?",
    advertise_link: "Anunciar no TRIBE",
    group_gender: "Gênero / Identidade",
    group_orientation: "Orientação Sexual",
    group_style: "Estilo / Cena",
    all_genders_chip: "🌈 Todos os gêneros / aberto a tudo",
    logout_button: "Sair",
    install_title_attr: "Instalar app",
    nav_discover: "Descobrir",
    nav_matches: "Matches",
    nav_profile: "Perfil",
    premium_banner_text: "Sem anúncios com o TRIBE Premium – {price} €/mês",
    view_button: "Ver",
    empty_discover_title: "Nenhuma pessoa nova no momento",
    empty_discover_text1: "Volte mais tarde ou ajuste suas categorias no perfil.",
    empty_discover_text2:
      "O TRIBE é bem novinho, então ainda só tem poucas pessoas cadastradas. Fica ligado(a) — quanto mais gente entrar, mais matches você também vai ter. Conta pros seus amigos da sua cena também! 🌱",
    undo_button_empty: "↺ Desfazer último swipe",
    reload_button: "Recarregar",
    undo_title_attr: "Desfazer último swipe",
    ad_continue_button: "Continuar →",
    ad_cta_fallback: "Saiba mais",
    ad_tag_label: "Anúncio",
    card_menu_title: "Denunciar ou bloquear",
    undo_alert_generic_prefix: "Não foi possível desfazer: ",
    match_title: "MATCH!",
    match_text: "Você e {name} deram match.",
    say_hi_button: "Mandar mensagem",
    keep_swiping_button: "Continuar dando swipe",
    report_button: "🚩 Denunciar",
    block_button: "🚫 Bloquear",
    block_confirm: "Bloquear {name} mesmo? Vocês não vão mais se ver.",
    default_person_label: "Usuário(a)",
    report_form_title: "Denunciar {name}",
    reason_label: "Motivo",
    additional_info_label: "Informações adicionais (opcional)",
    send_report_button: "Enviar denúncia",
    back_button: "Voltar",
    report_success: "Obrigado, sua denúncia foi enviada ✓",
    close_button: "Fechar",
    no_matches_title: "Ainda sem matches",
    no_matches_text: 'Vá para "Descobrir" e encontre sua turma.',
    match_search_placeholder: "Buscar por nome…",
    no_matches_found: "Nenhum match encontrado com esse nome.",
    say_hello_default: "Diga oi 👋",
    chat_loading: "Carregando…",
    chat_input_placeholder: "Mensagem…",
    send_button: "Enviar",
    photo_sheet_title: "Foto de perfil",
    take_photo_button: "📷 Tirar foto",
    choose_photo_button: "🖼️ Escolher da galeria",
    bio_label: "Bio",
    how_you_present_heading: "Como você se apresenta",
    what_you_seek_heading: "O que você procura",
    open_to_new_button: "🌈 Aberto(a) a coisas novas",
    open_to_new_text:
      "Ainda não tem certeza do que gosta? Ative isso para que o Descobrir também mostre pessoas fora da sua seleção acima — para você experimentar.",
    save_button: "Salvar",
    blocked_users_heading: "Usuários bloqueados",
    help_support_heading: "Ajuda e Suporte",
    language_heading: "Idioma",
    delete_account_heading: "Excluir conta",
    delete_account_desc:
      "Exclui permanentemente sua conta, perfil, matches, conversas e swipes. Uma assinatura Premium ativa será cancelada automaticamente.",
    delete_account_button: "🗑️ Excluir conta permanentemente",
    delete_confirm_prompt: 'Isso não pode ser desfeito. Digite "EXCLUIR" (em maiúsculas) para confirmar.',
    delete_confirm_word: "EXCLUIR",
    delete_success_alert: "Sua conta foi excluída.",
    saved_success: "Salvo ✓",
    premium_active_label: "✓ TRIBE Premium ativo",
    premium_active_until: "Sem anúncios até {date}",
    demo_suffix: " (Demo, sem dinheiro real)",
    cancel_premium_button: "Cancelar",
    premium_heading: "TRIBE Premium",
    premium_price_text: "Sem anúncios, {price} €/mês",
    upgrade_button: "Assinar",
    no_blocked_users: "Você não bloqueou ninguém.",
    unblock_button: "Desbloquear",
    blocked_load_error: "Não foi possível carregar os usuários bloqueados.",
    support_subject_placeholder: "Assunto",
    support_message_placeholder: "Como podemos ajudar?",
    send_ticket_button: "Enviar chamado",
    ticket_sent_success: "Chamado enviado ✓ – entraremos em contato por email.",
    your_tickets_heading: "Seus chamados",
    status_open: "aberto",
    status_closed: "fechado",
    reply_prefix: "Resposta: {reply}",
    backend_unreachable: "Backend inacessível. O servidor está rodando?",
  },
};

// Backend error codes -> localized text. Anything not listed here just
// falls back to the backend's own (German) message via errMsg().
const ERROR_STRINGS = {
  de: {
    UNAUTHORIZED: "Nicht angemeldet",
    RATE_LIMITED: "Zu viele Versuche. Bitte warte ein paar Minuten und versuch es nochmal.",
    MISSING_FIELDS: "Bitte fülle alle Pflichtfelder aus.",
    UNDERAGE: "Du musst mindestens 18 Jahre alt sein.",
    EMAIL_TAKEN: "E-Mail bereits registriert.",
    INVALID_CREDENTIALS: "E-Mail oder Passwort falsch.",
    ACCOUNT_BANNED: "Dieser Account wurde gesperrt.",
    USER_NOT_FOUND: "Nutzer nicht gefunden.",
    INVALID_IMAGE: "Ungültiges Bildformat.",
    TARGET_ID_REQUIRED: "Ungültige Anfrage.",
    ALREADY_MATCHED: "Ihr seid schon gematcht, das kann nicht rückgängig gemacht werden.",
    NO_ACCESS: "Kein Zugriff.",
    BLOCKED_CANNOT_MESSAGE: "Nachricht kann nicht gesendet werden.",
    EMPTY_MESSAGE: "Nachricht darf nicht leer sein.",
    CANNOT_REPORT_SELF: "Du kannst dich nicht selbst melden.",
    INVALID_REASON: "Ungültiger Grund.",
    INVALID_USER: "Ungültiger Nutzer.",
    SUPPORT_FIELDS_REQUIRED: "Betreff und Nachricht erforderlich.",
    STRIPE_NOT_CONFIGURED: "Stripe ist nicht konfiguriert.",
    SESSION_MISMATCH: "Diese Session gehört nicht zu deinem Account.",
    NO_ACTIVE_SUBSCRIPTION: "Kein aktives Abo gefunden.",
    ADS_NOT_LIVE: "Zahlungen sind noch nicht aktiv — bitte später erneut versuchen.",
    AD_FIELDS_REQUIRED: "Titel, Text, Button-Text und E-Mail sind erforderlich.",
  },
  en: {
    UNAUTHORIZED: "Not logged in",
    RATE_LIMITED: "Too many attempts. Please wait a few minutes and try again.",
    MISSING_FIELDS: "Please fill in all required fields.",
    UNDERAGE: "You must be at least 18 years old.",
    EMAIL_TAKEN: "Email already registered.",
    INVALID_CREDENTIALS: "Email or password incorrect.",
    ACCOUNT_BANNED: "This account has been suspended.",
    USER_NOT_FOUND: "User not found.",
    INVALID_IMAGE: "Invalid image format.",
    TARGET_ID_REQUIRED: "Invalid request.",
    ALREADY_MATCHED: "You're already matched, this can't be undone.",
    NO_ACCESS: "No access.",
    BLOCKED_CANNOT_MESSAGE: "Message can't be sent.",
    EMPTY_MESSAGE: "Message can't be empty.",
    CANNOT_REPORT_SELF: "You can't report yourself.",
    INVALID_REASON: "Invalid reason.",
    INVALID_USER: "Invalid user.",
    SUPPORT_FIELDS_REQUIRED: "Subject and message required.",
    STRIPE_NOT_CONFIGURED: "Stripe is not configured.",
    SESSION_MISMATCH: "This session doesn't belong to your account.",
    NO_ACTIVE_SUBSCRIPTION: "No active subscription found.",
    ADS_NOT_LIVE: "Payments aren't active yet — please try again later.",
    AD_FIELDS_REQUIRED: "Title, text, button label and email are required.",
  },
  pt: {
    UNAUTHORIZED: "Não conectado(a)",
    RATE_LIMITED: "Muitas tentativas. Espere alguns minutos e tente de novo.",
    MISSING_FIELDS: "Preencha todos os campos obrigatórios.",
    UNDERAGE: "Você precisa ter pelo menos 18 anos.",
    EMAIL_TAKEN: "Email já cadastrado.",
    INVALID_CREDENTIALS: "Email ou senha incorretos.",
    ACCOUNT_BANNED: "Esta conta foi suspensa.",
    USER_NOT_FOUND: "Usuário não encontrado.",
    INVALID_IMAGE: "Formato de imagem inválido.",
    TARGET_ID_REQUIRED: "Solicitação inválida.",
    ALREADY_MATCHED: "Vocês já são um match, isso não pode ser desfeito.",
    NO_ACCESS: "Sem acesso.",
    BLOCKED_CANNOT_MESSAGE: "Não é possível enviar a mensagem.",
    EMPTY_MESSAGE: "A mensagem não pode estar vazia.",
    CANNOT_REPORT_SELF: "Você não pode se denunciar.",
    INVALID_REASON: "Motivo inválido.",
    INVALID_USER: "Usuário inválido.",
    SUPPORT_FIELDS_REQUIRED: "Assunto e mensagem são obrigatórios.",
    STRIPE_NOT_CONFIGURED: "O Stripe não está configurado.",
    SESSION_MISMATCH: "Esta sessão não pertence à sua conta.",
    NO_ACTIVE_SUBSCRIPTION: "Nenhuma assinatura ativa encontrada.",
    ADS_NOT_LIVE: "Os pagamentos ainda não estão ativos — tente novamente mais tarde.",
    AD_FIELDS_REQUIRED: "Título, texto, texto do botão e email são obrigatórios.",
  },
};

// Category names come from the backend in German (matching logic works by
// id, not by name, so this is purely a display-layer translation and needs
// no backend/database changes).
const CATEGORY_TRANSLATIONS = {
  "Frau": { en: "Woman", pt: "Mulher" },
  "Mann": { en: "Man", pt: "Homem" },
  "Trans Frau": { en: "Trans woman", pt: "Mulher trans" },
  "Trans Mann": { en: "Trans man", pt: "Homem trans" },
  "Nicht-binär": { en: "Non-binary", pt: "Não binário" },
  "Genderqueer": { en: "Genderqueer", pt: "Genderqueer" },
  "Genderfluid": { en: "Genderfluid", pt: "Genderfluido" },
  "Agender": { en: "Agender", pt: "Agênero" },
  "Bigender": { en: "Bigender", pt: "Bigênero" },
  "Pangender": { en: "Pangender", pt: "Pangênero" },
  "Demigender": { en: "Demigender", pt: "Demigênero" },
  "Androgyn": { en: "Androgynous", pt: "Andrógino(a)" },
  "Two-Spirit": { en: "Two-Spirit", pt: "Two-Spirit" },
  "Intersex": { en: "Intersex", pt: "Intersexo" },
  "Cross-Dresser": { en: "Cross-dresser", pt: "Cross-dresser" },
  "Drag Queen": { en: "Drag Queen", pt: "Drag Queen" },
  "Drag King": { en: "Drag King", pt: "Drag King" },
  "Femme": { en: "Femme", pt: "Femme" },
  "Butch": { en: "Butch", pt: "Butch" },
  "Femboy": { en: "Femboy", pt: "Femboy" },
  "Tomboy": { en: "Tomboy", pt: "Moleca" },
  "Erkunde ich noch (Gender)": { en: "Still exploring (Gender)", pt: "Ainda descobrindo (Gênero)" },
  "Heterosexuell": { en: "Heterosexual", pt: "Heterossexual" },
  "Homosexuell": { en: "Homosexual", pt: "Homossexual" },
  "Lesbisch": { en: "Lesbian", pt: "Lésbica" },
  "Bisexuell": { en: "Bisexual", pt: "Bissexual" },
  "Pansexuell": { en: "Pansexual", pt: "Pansexual" },
  "Asexuell": { en: "Asexual", pt: "Assexual" },
  "Demisexuell": { en: "Demisexual", pt: "Demissexual" },
  "Queer": { en: "Queer", pt: "Queer" },
  "Unsicher (Orientierung)": { en: "Not sure (Orientation)", pt: "Sem certeza (Orientação)" },
  "Emo": { en: "Emo", pt: "Emo" },
  "Gothic": { en: "Gothic", pt: "Gótico" },
  "Soft Boy": { en: "Soft Boy", pt: "Soft Boy" },
  "E-Boy": { en: "E-Boy", pt: "E-Boy" },
  "E-Girl": { en: "E-Girl", pt: "E-Girl" },
  "Punk": { en: "Punk", pt: "Punk" },
  "Scene": { en: "Scene", pt: "Scene" },
  "Grunge": { en: "Grunge", pt: "Grunge" },
  "Metalhead": { en: "Metalhead", pt: "Metaleiro(a)" },
  "Cyberpunk": { en: "Cyberpunk", pt: "Cyberpunk" },
  "Techwear": { en: "Techwear", pt: "Techwear" },
};
function translateCategoryName(name) {
  if (currentLang === "de") return name;
  const tr = CATEGORY_TRANSLATIONS[name];
  return tr && tr[currentLang] ? tr[currentLang] : name;
}

// Report reasons are a small fixed enum shared with the backend
// (REPORT_REASONS in server.js) — the value submitted must stay the
// original German string, only the displayed label is translated.
const REASON_TRANSLATIONS = {
  "Unangemessene Inhalte": { en: "Inappropriate content", pt: "Conteúdo inapropriado" },
  "Belästigung": { en: "Harassment", pt: "Assédio" },
  "Fake-Profil / Betrug": { en: "Fake profile / scam", pt: "Perfil falso / golpe" },
  "Minderjährig": { en: "Underage", pt: "Menor de idade" },
  "Sonstiges": { en: "Other", pt: "Outro" },
};
function translateReason(reason) {
  if (currentLang === "de") return reason;
  const tr = REASON_TRANSLATIONS[reason];
  return tr && tr[currentLang] ? tr[currentLang] : reason;
}

// ---------- PWA install prompt ----------
// Chrome/Android fire this before showing their own install UI; we capture
// it so we can trigger the native install dialog from our own button.
let deferredInstallPrompt = null;
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

// In-app browsers (WhatsApp, Instagram, Facebook, TikTok, Messenger, Line, ...)
// are WebViews that never fire beforeinstallprompt and block real "Add to
// Home Screen" support — the only fix is opening the link in the real
// browser (Chrome/Safari) first.
const isInAppBrowser = () =>
  /FBAN|FBAV|Instagram|Line\/|WhatsApp|TikTok|MicroMessenger|Snapchat/i.test(window.navigator.userAgent);

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

async function handleInstallClick() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    const btn = document.getElementById("install-app-btn");
    if (btn) btn.style.display = "none";
  } else if (isInAppBrowser()) {
    alert(t("install_inapp_alert"));
  } else if (isIos()) {
    alert(t("install_ios_alert"));
  } else {
    alert(t("install_generic_alert"));
  }
}

function renderInstallButton() {
  if (isStandalone()) return ""; // already installed, no need to show it
  return `<button type="button" id="install-app-btn" class="btn-secondary" style="width:100%; margin-top:14px;">${t("install_button")}</button>`;
}

const state = {
  token: localStorage.getItem("tribe_token") || null,
  user: null,
  categories: [],
  tab: "discover",
  deck: [],
  // Stack of recent swipes (most recent last) so more than just the very
  // last swipe can be undone — capped at MAX_SWIPE_HISTORY entries below.
  swipeHistory: [],
  matches: [],
  matchSearch: "",
  activeChat: null, // {matchId, other}
  chatMessages: [],
  authMode: "login",
};

// ---------- API helper ----------
async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && state.token) headers["Authorization"] = "Bearer " + state.token;
  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || t("generic_error"));
    err.code = data.code;
    throw err;
  }
  return data;
}

function catName(id) {
  const c = state.categories.find((c) => c.id === id);
  return c ? translateCategoryName(c.name) : "?";
}

// ---------- render root ----------
function render() {
  if (!state.token || !state.user) {
    $app.innerHTML = "";
    $app.appendChild(renderAuth());
    return;
  }
  $app.innerHTML = "";
  $app.appendChild(renderAppShell());
}

// ================= AUTH =================
function renderAuth() {
  const wrap = document.createElement("div");
  wrap.className = "auth-screen";

  const mode = state.authMode;
  wrap.innerHTML = `
    <div>
      <div style="display:flex; justify-content:flex-end;">
        <button type="button" id="auth-lang-btn" class="btn-ghost" style="font-size:13px; padding:4px 10px;">🌐 ${LANG_LABELS[currentLang]}</button>
      </div>
      <h1 class="brand">TRIBE</h1>
      <p class="tagline">${TAGLINE}</p>
      ${renderInstallButton()}
    </div>
    <div class="beta-notice">
      ${t("beta_notice_1")}
      <a href="mailto:tribeapp.support@gmail.com" style="color:var(--accent2);">tribeapp.support@gmail.com</a>.
    </div>
    <div class="beta-notice">
      ${t("beta_notice_2")}
    </div>
    <div class="tabs">
      <button data-mode="login" class="${mode === "login" ? "active" : ""}">${t("login_tab")}</button>
      <button data-mode="register" class="${mode === "register" ? "active" : ""}">${t("register_tab")}</button>
    </div>
    <div id="auth-error"></div>
    <form id="auth-form" class="field" style="gap:14px;"></form>
    <p style="text-align:center; font-size:12px; color:var(--text-dim); margin-top:8px;">
      ${t("consent_text_prefix")}
      <a href="${privacyUrl()}" target="_blank" style="color:var(--accent2);">${t("privacy_link")}</a>
      ${t("and_text")}
      <a href="${childSafetyUrl()}" target="_blank" style="color:var(--accent2);">${t("child_safety_link")}</a>.
      ${t("consent_age_text")}
    </p>
    <p style="text-align:center; font-size:12px; color:var(--text-dim); margin-top:4px;">
      ${t("advertise_prompt")}
      <a href="/advertise.html" target="_blank" style="color:var(--accent2);">${t("advertise_link")}</a>
    </p>
  `;

  wrap.querySelector("#auth-lang-btn").onclick = openLanguageSheet;

  const installBtn = wrap.querySelector("#install-app-btn");
  if (installBtn) installBtn.onclick = handleInstallClick;

  wrap.querySelectorAll(".tabs button").forEach((btn) => {
    btn.onclick = () => {
      state.authMode = btn.dataset.mode;
      render();
    };
  });

  const form = wrap.querySelector("#auth-form");
  if (mode === "login") {
    form.innerHTML = `
      <div class="field"><label>${t("email_label")}</label><input type="email" name="email" required /></div>
      <div class="field">
        <label>${t("password_label")}</label>
        <div class="password-wrap">
          <input type="password" name="password" required />
          <button type="button" class="toggle-password" tabindex="-1">👁️</button>
        </div>
      </div>
      <button class="btn-primary" type="submit">${t("login_submit")}</button>
    `;
  } else {
    form.innerHTML = `
      <div class="field"><label>${t("name_label")}</label><input type="text" name="name" required /></div>
      <div class="field"><label>${t("email_label")}</label><input type="email" name="email" required /></div>
      <div class="field">
        <label>${t("password_label")}</label>
        <div class="password-wrap">
          <input type="password" name="password" minlength="6" required />
          <button type="button" class="toggle-password" tabindex="-1">👁️</button>
        </div>
      </div>
      <div class="field">
        <label>${t("birthdate_label")}</label>
        <div style="display:flex; gap:8px;">
          <select name="birthDay" required style="flex:1;"><option value="">${t("day_placeholder")}</option></select>
          <select name="birthMonth" required style="flex:1.4;"><option value="">${t("month_placeholder")}</option></select>
          <select name="birthYear" required style="flex:1.2;"><option value="">${t("year_placeholder")}</option></select>
        </div>
      </div>
      <div class="field"><label>${t("location_label")}</label><input type="text" name="location" placeholder="${t("location_placeholder")}" /></div>
      <div class="field">
        <label>${t("identity_label")}</label>
        <div id="identity-picker"></div>
      </div>
      <div class="field">
        <label>${t("seeking_label")}</label>
        <div id="seeking-picker"></div>
      </div>
      <div class="field">
        <label>${t("age_range_label")}</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="number" name="ageMin" min="18" max="99" value="18" style="width:90px;" />${t("to_separator")}
          <input type="number" name="ageMax" min="18" max="99" value="99" style="width:90px;" />
        </div>
      </div>
      <button class="btn-primary" type="submit">${t("register_submit")}</button>
    `;
    const identitySel = new Set();
    const seekingSel = new Set();
    renderGroupedTagPicker(form.querySelector("#identity-picker"), identitySel);
    renderGroupedTagPicker(form.querySelector("#seeking-picker"), seekingSel, { seekingMode: true });
    form._identitySel = identitySel;
    form._seekingSel = seekingSel;
  }

  populateBirthdateSelects(form);

  form.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.onclick = () => {
      const input = btn.previousElementSibling;
      const showing = input.type === "text";
      input.type = showing ? "password" : "text";
      btn.textContent = showing ? "👁️" : "🙈";
    };
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const errEl = wrap.querySelector("#auth-error");
    errEl.innerHTML = "";
    try {
      let data;
      if (mode === "login") {
        data = await api("/api/auth/login", {
          method: "POST",
          auth: false,
          body: { email: fd.get("email"), password: fd.get("password") },
        });
      } else {
        data = await api("/api/auth/register", {
          method: "POST",
          auth: false,
          body: {
            name: fd.get("name"),
            email: fd.get("email"),
            password: fd.get("password"),
            birthdate: `${fd.get("birthYear")}-${String(fd.get("birthMonth")).padStart(2, "0")}-${String(fd.get("birthDay")).padStart(2, "0")}`,
            location: fd.get("location") || "",
            identity: [...form._identitySel],
            seeking: [...form._seekingSel],
            seekAgeMin: fd.get("ageMin"),
            seekAgeMax: fd.get("ageMax"),
          },
        });
      }
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem("tribe_token", data.token);
      state.tab = "discover";
      await loadDeck();
      render();
    } catch (err) {
      errEl.innerHTML = `<div class="error-msg">${escapeHtml(errMsg(err))}</div>`;
    }
  };

  return wrap;
}

function privacyUrl() {
  if (currentLang === "en") return "/privacy-en.html";
  if (currentLang === "pt") return "/privacy-pt.html";
  return "/privacy.html";
}
function childSafetyUrl() {
  if (currentLang === "en") return "/child-safety-en.html";
  if (currentLang === "pt") return "/child-safety-pt.html";
  return "/child-safety.html";
}

// Fills the day/month/year birthdate dropdowns, if present in the form.
// Using plain <select> elements instead of a native date input avoids the
// painfully slow month-by-month calendar swipe some mobile browsers show.
function populateBirthdateSelects(form) {
  const daySel = form.querySelector('select[name="birthDay"]');
  const monthSel = form.querySelector('select[name="birthMonth"]');
  const yearSel = form.querySelector('select[name="birthYear"]');
  if (!daySel || !monthSel || !yearSel) return;
  if (daySel.dataset.filled) return; // avoid re-filling on re-render

  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = String(d);
    opt.textContent = String(d);
    daySel.appendChild(opt);
  }
  (MONTH_NAMES[currentLang] || MONTH_NAMES.de).forEach((name, i) => {
    const opt = document.createElement("option");
    opt.value = String(i + 1);
    opt.textContent = name;
    monthSel.appendChild(opt);
  });
  const currentYear = new Date().getFullYear();
  // Most recent eligible birth year (18+) first, so the common case
  // (younger adults signing up) needs the least scrolling.
  for (let y = currentYear - 18; y >= currentYear - 100; y--) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    yearSel.appendChild(opt);
  }
  daySel.dataset.filled = "1";
}

function groupLabel(type) {
  if (type === "gender") return t("group_gender");
  if (type === "orientation") return t("group_orientation");
  if (type === "style") return t("group_style");
  return type;
}

// Renders category chips grouped into sections (gender / orientation /
// style). In seekingMode, adds an "all genders / open to anyone" chip
// that clears gender+orientation selections in one click — for people who
// don't want to filter by gender/orientation at all.
function renderGroupedTagPicker(container, selectedSet, { seekingMode = false } = {}) {
  container.innerHTML = "";

  if (seekingMode) {
    const genderOrientationIds = state.categories
      .filter((c) => c.type === "gender" || c.type === "orientation")
      .map((c) => c.id);
    const allChip = document.createElement("button");
    allChip.type = "button";
    const isAllActive = !genderOrientationIds.some((id) => selectedSet.has(id));
    allChip.className = "tag-chip" + (isAllActive ? " selected" : "");
    allChip.style.marginBottom = "12px";
    allChip.textContent = t("all_genders_chip");
    allChip.onclick = () => {
      genderOrientationIds.forEach((id) => selectedSet.delete(id));
      renderGroupedTagPicker(container, selectedSet, { seekingMode });
    };
    container.appendChild(allChip);
  }

  ["gender", "orientation", "style"].forEach((type) => {
    const cats = state.categories.filter((c) => c.type === type);
    if (cats.length === 0) return;
    const heading = document.createElement("div");
    heading.className = "section-title";
    heading.style.margin = "10px 0 6px";
    heading.textContent = groupLabel(type);
    container.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "tag-grid";
    cats.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip" + (selectedSet.has(cat.id) ? " selected" : "");
      chip.textContent = translateCategoryName(cat.name);
      chip.onclick = () => {
        if (selectedSet.has(cat.id)) selectedSet.delete(cat.id);
        else selectedSet.add(cat.id);
        renderGroupedTagPicker(container, selectedSet, { seekingMode });
      };
      grid.appendChild(chip);
    });
    container.appendChild(grid);
  });
}

// ================= APP SHELL =================
function renderAppShell() {
  const wrap = document.createElement("div");
  wrap.className = "app-shell";

  const topbar = document.createElement("div");
  topbar.className = "topbar";
  topbar.style.display = "flex";
  topbar.style.alignItems = "center";
  topbar.style.justifyContent = "space-between";
  topbar.style.gap = "10px";
  topbar.innerHTML = `
    <span class="brand">TRIBE</span>
    <div style="display:flex; align-items:center; gap:10px;">
      <button type="button" id="topbar-lang-btn" class="btn-ghost" title="${t("language_heading")}" style="font-size:16px; line-height:1; padding:4px 8px;">🌐</button>
      ${
        isStandalone()
          ? ""
          : `<button type="button" id="topbar-install-btn" class="btn-ghost" title="${t("install_title_attr")}" style="font-size:20px; line-height:1; padding:4px 8px;">📲</button>`
      }
    </div>
  `;
  const logoutBtn = document.createElement("button");
  logoutBtn.className = "btn-ghost";
  logoutBtn.textContent = t("logout_button");
  logoutBtn.onclick = () => {
    localStorage.removeItem("tribe_token");
    state.token = null;
    state.user = null;
    render();
  };
  topbar.querySelector("div").appendChild(logoutBtn);
  topbar.querySelector("#topbar-lang-btn").onclick = openLanguageSheet;
  const topbarInstallBtn = topbar.querySelector("#topbar-install-btn");
  if (topbarInstallBtn) topbarInstallBtn.onclick = handleInstallClick;
  wrap.appendChild(topbar);

  const view = document.createElement("div");
  view.className = "view";
  view.id = "view";
  wrap.appendChild(view);

  if (state.tab !== "chat") {
    const nav = document.createElement("div");
    nav.className = "bottom-nav";
    nav.innerHTML = `
      <button data-tab="discover"><span class="icon">✨</span>${t("nav_discover")}</button>
      <button data-tab="matches"><span class="icon">💬</span>${t("nav_matches")}</button>
      <button data-tab="profile"><span class="icon">👤</span>${t("nav_profile")}</button>
    `;
    nav.querySelectorAll("button").forEach((btn) => {
      if (btn.dataset.tab === state.tab) btn.classList.add("active");
      btn.onclick = async () => {
        state.tab = btn.dataset.tab;
        if (state.tab === "matches") await loadMatches();
        render();
      };
    });
    wrap.appendChild(nav);
  }

  renderTabContent(view);
  return wrap;
}

function renderTabContent(view) {
  if (state.tab === "discover") return renderDiscover(view);
  if (state.tab === "matches") return renderMatches(view);
  if (state.tab === "profile") return renderProfile(view);
  if (state.tab === "chat") return renderChat(view);
}

// ================= DISCOVER =================
function interleaveAds(deck, ad) {
  if (!ad) return deck;
  const out = [];
  deck.forEach((p, i) => {
    out.push(p);
    if ((i + 1) % 20 === 0) out.push({ _ad: true, ...ad, id: `ad-${i}-${Math.random()}` });
  });
  return out;
}

async function loadDeck() {
  const deck = await api("/api/discover");
  if (!state.user.premium) {
    try {
      const ad = await api("/api/ads");
      state.deck = interleaveAds(deck, ad);
    } catch {
      state.deck = deck;
    }
  } else {
    state.deck = deck;
  }
}

function renderDiscover(view) {
  if (!state.user.premium) {
    const banner = document.createElement("div");
    banner.className = "info-msg";
    banner.style.marginBottom = "12px";
    banner.style.display = "flex";
    banner.style.justifyContent = "space-between";
    banner.style.alignItems = "center";
    banner.style.gap = "10px";
    banner.innerHTML = `<span>${t("premium_banner_text", { price: PREMIUM_PRICE.toFixed(2) })}</span>`;
    const goBtn = document.createElement("button");
    goBtn.className = "btn-ghost";
    goBtn.style.whiteSpace = "nowrap";
    goBtn.textContent = t("view_button");
    goBtn.onclick = () => {
      state.tab = "profile";
      render();
    };
    banner.appendChild(goBtn);
    view.appendChild(banner);
  }

  if (state.deck.length === 0) {
    view.innerHTML = `
      <div class="empty-state">
        <div class="emoji">🌱</div>
        <h3>${t("empty_discover_title")}</h3>
        <p>${t("empty_discover_text1")}</p>
        <p style="margin-top:10px;">${t("empty_discover_text2")}</p>
      </div>
    `;
    // Even with an empty deck, the last swipe(s) should still be undoable —
    // this is exactly the case where the deck just ran out because of the
    // swipe you want to take back.
    if (state.swipeHistory.length > 0) {
      const undoBtn = document.createElement("button");
      undoBtn.className = "btn-secondary";
      undoBtn.style.marginTop = "12px";
      undoBtn.textContent = t("undo_button_empty");
      undoBtn.onclick = () => undoSwipe();
      view.appendChild(undoBtn);
    }
    const btn = document.createElement("button");
    btn.className = "btn-secondary";
    btn.style.marginTop = "12px";
    btn.textContent = t("reload_button");
    btn.onclick = async () => {
      await loadDeck();
      render();
    };
    view.appendChild(btn);
    return;
  }

  const stack = document.createElement("div");
  stack.className = "card-stack";
  // render up to 3 cards, topmost is last swiped index 0
  state.deck.slice(0, 3).reverse().forEach((person, i, arr) => {
    const isTop = i === arr.length - 1;
    const card = buildSwipeCard(person, isTop);
    stack.appendChild(card);
  });
  view.appendChild(stack);

  const topIsAd = !!state.deck[0]._ad;
  if (!topIsAd) {
    const actions = document.createElement("div");
    actions.className = "swipe-actions";
    actions.innerHTML = `
      <button class="undo-btn" id="undo-btn" title="${t("undo_title_attr")}" ${state.swipeHistory.length > 0 ? "" : "disabled"}>↺</button>
      <button class="nope-btn" id="nope-btn">✕</button>
      <button class="like-btn" id="like-btn">♥</button>
    `;
    view.appendChild(actions);
    actions.querySelector("#nope-btn").onclick = () => swipeTop(false);
    actions.querySelector("#like-btn").onclick = () => swipeTop(true);
    actions.querySelector("#undo-btn").onclick = () => undoSwipe();
  } else {
    const actions = document.createElement("div");
    actions.className = "swipe-actions";
    actions.innerHTML = `<button class="btn-secondary" id="ad-continue-btn" style="width:100%; border-radius:12px;">${t("ad_continue_button")}</button>`;
    view.appendChild(actions);
    actions.querySelector("#ad-continue-btn").onclick = () => dismissAd();
  }
}

function buildSwipeCard(person, isTop) {
  const card = document.createElement("div");
  card.className = "swipe-card";
  card.dataset.userId = person.id;

  if (person._ad) {
    card.innerHTML = `
      <div class="photo">${person.emoji || "📢"}</div>
      <div class="info">
        <div class="name-age">${escapeHtml(person.title)}</div>
        <div class="bio">${escapeHtml(person.body)}</div>
        <div class="tag-grid"><span class="tag-chip readonly">${t("ad_tag_label")}</span></div>
        <button class="btn-secondary" style="margin-top:14px; width:100%;">${escapeHtml(person.cta_label || t("ad_cta_fallback"))}</button>
      </div>
    `;
    if (isTop) attachDrag(card, document.createElement("div"), document.createElement("div"), true);
    return card;
  }

  const photo = document.createElement("div");
  photo.className = "photo";
  if (person.photo_url) {
    photo.style.backgroundImage = `url(${person.photo_url})`;
  } else {
    photo.textContent = "🙂";
  }
  card.appendChild(photo);

  const info = document.createElement("div");
  info.className = "info";
  info.innerHTML = `
    <div class="name-age">${escapeHtml(person.name)}, ${person.age}</div>
    ${person.location ? `<div class="bio">📍 ${escapeHtml(person.location)}</div>` : ""}
    <div class="bio">${escapeHtml(person.bio || "")}</div>
    <div class="tag-grid">
      ${person.identity.map((tag) => `<span class="tag-chip readonly">${escapeHtml(translateCategoryName(tag.name))}</span>`).join("")}
    </div>
  `;
  card.appendChild(info);

  const likeBadge = document.createElement("div");
  likeBadge.className = "swipe-badge like";
  likeBadge.textContent = "LIKE";
  const nopeBadge = document.createElement("div");
  nopeBadge.className = "swipe-badge nope";
  nopeBadge.textContent = "NOPE";
  card.appendChild(likeBadge);
  card.appendChild(nopeBadge);

  const menuBtn = document.createElement("button");
  menuBtn.type = "button";
  menuBtn.className = "card-menu-btn";
  menuBtn.title = t("card_menu_title");
  menuBtn.textContent = "⋯";
  menuBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    showReportBlockMenu(person, {
      onBlocked: () => {
        state.deck = state.deck.filter((p) => p.id !== person.id);
        render();
      },
    });
  };
  card.appendChild(menuBtn);

  if (isTop) attachDrag(card, likeBadge, nopeBadge);
  return card;
}

function dismissAd() {
  if (swiping || state.deck.length === 0) return;
  state.deck.shift();
  render();
}

function attachDrag(card, likeBadge, nopeBadge, isAd = false) {
  let startX = 0, startY = 0, dx = 0, dragging = false;

  const onDown = (x, y) => {
    dragging = true;
    startX = x;
    startY = y;
    card.style.transition = "none";
  };
  const onMove = (x, y) => {
    if (!dragging) return;
    dx = x - startX;
    const dy = y - startY;
    const rot = dx / 12;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    likeBadge.style.opacity = Math.min(Math.max(dx / 80, 0), 1);
    nopeBadge.style.opacity = Math.min(Math.max(-dx / 80, 0), 1);
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    card.style.transition = "transform 0.3s ease";
    if (dx > 100) {
      flyOut(card, 1);
      isAd ? dismissAd() : swipeTop(true);
    } else if (dx < -100) {
      flyOut(card, -1);
      isAd ? dismissAd() : swipeTop(false);
    } else {
      card.style.transform = "";
      likeBadge.style.opacity = 0;
      nopeBadge.style.opacity = 0;
    }
    dx = 0;
  };

  card.addEventListener("pointerdown", (e) => {
    card.setPointerCapture(e.pointerId);
    onDown(e.clientX, e.clientY);
  });
  card.addEventListener("pointermove", (e) => onMove(e.clientX, e.clientY));
  card.addEventListener("pointerup", onUp);
  card.addEventListener("pointercancel", onUp);
}

function flyOut(card, dir) {
  card.style.transition = "transform 0.4s ease";
  card.style.transform = `translate(${dir * 600}px, -40px) rotate(${dir * 30}deg)`;
}

// Keep at most this many past swipes undoable, so the history array can't
// grow without bound during a long swiping session.
const MAX_SWIPE_HISTORY = 20;

let swiping = false;
async function swipeTop(liked) {
  if (swiping || state.deck.length === 0 || state.deck[0]._ad) return;
  swiping = true;
  const person = state.deck.shift();
  try {
    const res = await api("/api/swipe", { method: "POST", body: { targetId: person.id, liked } });
    if (res.match) {
      // This particular swipe can't be undone (the backend rejects undoing a
      // swipe that already turned into a match) — but earlier swipes in the
      // history are still fine, so we leave swipeHistory untouched here.
      showMatchToast(person);
    } else {
      state.swipeHistory.push({ person, liked });
      if (state.swipeHistory.length > MAX_SWIPE_HISTORY) state.swipeHistory.shift();
      render();
    }
  } catch (err) {
    render();
  }
  swiping = false;
}

async function undoSwipe() {
  if (state.swipeHistory.length === 0 || swiping) return;
  swiping = true;
  // Peek (not pop) so a failed undo doesn't silently lose that history entry.
  const { person } = state.swipeHistory[state.swipeHistory.length - 1];
  try {
    await api(`/api/swipe/${person.id}`, { method: "DELETE" });
    state.swipeHistory.pop();
    state.deck.unshift(person);
  } catch (err) {
    // Most likely: a match already formed for this swipe in the meantime,
    // so it can no longer be undone — drop it and tell the user why.
    state.swipeHistory.pop();
    alert(err.code === "ALREADY_MATCHED" ? errMsg(err) : t("undo_alert_generic_prefix") + errMsg(err));
  }
  swiping = false;
  render();
}

function showMatchToast(person) {
  const toast = document.createElement("div");
  toast.className = "match-toast";
  toast.innerHTML = `
    <h1 class="brand">${t("match_title")}</h1>
    <div class="avatars">
      <div class="avatar" style="${state.user.photo_url ? `background-image:url(${state.user.photo_url})` : ""}">${state.user.photo_url ? "" : "🙂"}</div>
      <div class="avatar" style="${person.photo_url ? `background-image:url(${person.photo_url})` : ""}">${person.photo_url ? "" : "🙂"}</div>
    </div>
    <p>${t("match_text", { name: escapeHtml(person.name) })}</p>
    <button class="btn-primary" id="say-hi">${t("say_hi_button")}</button>
    <button class="btn-ghost" id="keep-swiping">${t("keep_swiping_button")}</button>
  `;
  document.body.appendChild(toast);
  toast.querySelector("#keep-swiping").onclick = () => {
    toast.remove();
    render();
  };
  toast.querySelector("#say-hi").onclick = async () => {
    toast.remove();
    await loadMatches();
    const m = state.matches.find((m) => m.other.id === person.id);
    if (m) openChat(m);
    else render();
  };
}

// ================= MELDEN / BLOCKIEREN =================
let reportReasonsCache = null;
async function getReportReasons() {
  if (reportReasonsCache) return reportReasonsCache;
  try {
    reportReasonsCache = await api("/api/report/reasons", { auth: false });
  } catch {
    reportReasonsCache = [
      "Unangemessene Inhalte",
      "Belästigung",
      "Fake-Profil / Betrug",
      "Minderjährig",
      "Sonstiges",
    ];
  }
  return reportReasonsCache;
}

async function showReportBlockMenu(person, { onBlocked } = {}) {
  const reasons = await getReportReasons();
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  const close = () => overlay.remove();
  const personLabel = person.name || t("default_person_label");

  function renderMenu() {
    overlay.innerHTML = `
      <div class="sheet-box">
        <h3>${escapeHtml(personLabel)}</h3>
        <button class="btn-secondary" id="report-btn">${t("report_button")}</button>
        <button class="btn-secondary" id="block-btn" style="color: var(--danger); border-color: var(--danger);">${t("block_button")}</button>
        <button class="btn-ghost" id="cancel-btn">${t("cancel")}</button>
      </div>
    `;
    overlay.querySelector("#cancel-btn").onclick = close;
    overlay.querySelector("#report-btn").onclick = renderReportForm;
    overlay.querySelector("#block-btn").onclick = async () => {
      if (!confirm(t("block_confirm", { name: personLabel }))) return;
      try {
        await api(`/api/block/${person.id}`, { method: "POST" });
        close();
        if (onBlocked) onBlocked();
      } catch (err) {
        alert(errMsg(err));
      }
    };
  }

  function renderReportForm() {
    overlay.innerHTML = `
      <div class="sheet-box">
        <h3>${t("report_form_title", { name: escapeHtml(personLabel) })}</h3>
        <div class="field">
          <label>${t("reason_label")}</label>
          <select id="report-reason">
            ${reasons.map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(translateReason(r))}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>${t("additional_info_label")}</label>
          <textarea id="report-message" rows="3"></textarea>
        </div>
        <div id="report-error"></div>
        <button class="btn-primary" id="submit-report-btn">${t("send_report_button")}</button>
        <button class="btn-ghost" id="back-btn">${t("back_button")}</button>
      </div>
    `;
    overlay.querySelector("#back-btn").onclick = renderMenu;
    overlay.querySelector("#submit-report-btn").onclick = async () => {
      const errEl = overlay.querySelector("#report-error");
      errEl.innerHTML = "";
      try {
        await api("/api/report", {
          method: "POST",
          body: {
            targetId: person.id,
            reason: overlay.querySelector("#report-reason").value,
            message: overlay.querySelector("#report-message").value.trim(),
          },
        });
        overlay.innerHTML = `
          <div class="sheet-box">
            <p class="info-msg">${t("report_success")}</p>
            <button class="btn-secondary" id="done-btn">${t("close_button")}</button>
          </div>
        `;
        overlay.querySelector("#done-btn").onclick = close;
      } catch (err) {
        errEl.innerHTML = `<div class="error-msg">${escapeHtml(errMsg(err))}</div>`;
      }
    };
  }

  renderMenu();
  document.body.appendChild(overlay);
}

// ================= MATCHES =================
async function loadMatches() {
  state.matches = await api("/api/matches");
}

function renderMatches(view) {
  if (state.matches.length === 0) {
    view.innerHTML = `
      <div class="empty-state">
        <div class="emoji">💌</div>
        <h3>${t("no_matches_title")}</h3>
        <p>${t("no_matches_text")}</p>
      </div>
    `;
    return;
  }

  const searchWrap = document.createElement("div");
  searchWrap.style.marginBottom = "14px";
  searchWrap.innerHTML = `<input type="text" id="match-search" placeholder="${t("match_search_placeholder")}" value="${escapeHtml(state.matchSearch)}" />`;
  view.appendChild(searchWrap);

  const listContainer = document.createElement("div");
  view.appendChild(listContainer);
  renderMatchList(listContainer);

  searchWrap.querySelector("#match-search").oninput = (e) => {
    state.matchSearch = e.target.value;
    renderMatchList(listContainer);
  };
}

function renderMatchList(list) {
  list.innerHTML = "";
  const q = state.matchSearch.trim().toLowerCase();
  const filtered = q
    ? state.matches.filter((m) => m.other.name.toLowerCase().includes(q))
    : state.matches;

  if (filtered.length === 0) {
    list.innerHTML = `<p style="color: var(--text-dim); font-size: 14px;">${t("no_matches_found")}</p>`;
    return;
  }

  filtered.forEach((m) => {
    const row = document.createElement("div");
    row.className = "match-row";
    row.innerHTML = `
      <div class="avatar" style="${m.other.photo_url ? `background-image:url(${m.other.photo_url})` : ""}">${m.other.photo_url ? "" : "🙂"}</div>
      <div>
        <div class="name">${escapeHtml(m.other.name)}</div>
        <div class="preview">${m.lastMessage ? escapeHtml(m.lastMessage.body) : t("say_hello_default")}</div>
      </div>
    `;
    row.onclick = () => openChat(m);
    list.appendChild(row);
  });
  view.appendChild(list);
}

function openChat(m) {
  state.activeChat = { matchId: m.matchId, other: m.other };
  state.tab = "chat";
  render();
  loadChatMessages();
}

// ================= CHAT =================
let chatPoll = null;

async function loadChatMessages() {
  if (!state.activeChat) return;
  state.chatMessages = await api(`/api/matches/${state.activeChat.matchId}/messages`);
  const list = document.getElementById("chat-messages");
  if (list) {
    list.innerHTML = state.chatMessages
      .map(
        (msg) =>
          `<div class="msg ${msg.sender_id === state.user.id ? "mine" : "theirs"}">${escapeHtml(msg.body)}</div>`
      )
      .join("");
    list.scrollTop = list.scrollHeight;
  }
}

function renderChat(view) {
  view.style.padding = "0";
  clearInterval(chatPoll);
  const other = state.activeChat.other;
  view.innerHTML = `
    <div class="chat-view">
      <div class="chat-header">
        <button class="btn-ghost" id="back-btn">←</button>
        <div class="avatar" style="${other.photo_url ? `background-image:url(${other.photo_url})` : ""}">${other.photo_url ? "" : "🙂"}</div>
        <div class="name">${escapeHtml(other.name)}</div>
        <button class="btn-ghost" id="chat-menu-btn" style="margin-left:auto; font-size:20px; padding:4px 10px;">⋯</button>
      </div>
      <div class="chat-messages" id="chat-messages"><div class="loading">${t("chat_loading")}</div></div>
      <form class="chat-input" id="chat-form">
        <input type="text" id="chat-text" placeholder="${t("chat_input_placeholder")}" autocomplete="off" />
        <button type="submit">${t("send_button")}</button>
      </form>
    </div>
  `;
  view.querySelector("#back-btn").onclick = () => {
    clearInterval(chatPoll);
    state.tab = "matches";
    render();
  };
  view.querySelector("#chat-menu-btn").onclick = () => {
    showReportBlockMenu(other, {
      onBlocked: () => {
        clearInterval(chatPoll);
        state.tab = "matches";
        render();
      },
    });
  };
  view.querySelector("#chat-form").onsubmit = async (e) => {
    e.preventDefault();
    const input = view.querySelector("#chat-text");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await api(`/api/matches/${state.activeChat.matchId}/messages`, {
      method: "POST",
      body: { body: text },
    });
    await loadChatMessages();
  };
  loadChatMessages();
  chatPoll = setInterval(loadChatMessages, 3000);
}

// ================= PROFILE =================
function renderProfile(view) {
  const u = state.user;
  view.innerHTML = `
    ${renderInstallButton()}
    <div class="beta-notice">
      ${t("beta_notice_profile")}
      <a href="mailto:tribeapp.support@gmail.com" style="color:var(--accent2);">tribeapp.support@gmail.com</a>.
    </div>
    <div class="profile-photo-upload" id="photo-upload" style="${u.photo_url ? `background-image:url(${u.photo_url})` : ""}">
      ${u.photo_url ? "" : "📷"}
    </div>
    <input type="file" id="photo-input-camera" accept="image/*" capture="environment" style="display:none" />
    <input type="file" id="photo-input-gallery" accept="image/*" style="display:none" />

    <div id="premium-box"></div>

    <div class="field"><label>${t("name_label")}</label><input type="text" id="name-input" value="${escapeHtml(u.name)}" /></div>
    <div class="field" style="margin-top:12px;"><label>${t("location_label")}</label><input type="text" id="location-input" value="${escapeHtml(u.location || "")}" placeholder="${t("location_placeholder")}" /></div>
    <div class="field" style="margin-top:12px;"><label>${t("bio_label")}</label><textarea id="bio-input" rows="3">${escapeHtml(u.bio || "")}</textarea></div>

    <div class="section-title">${t("how_you_present_heading")}</div>
    <div id="identity-picker"></div>

    <div class="section-title">${t("what_you_seek_heading")}</div>
    <div id="seeking-picker"></div>

    <button type="button" id="open-to-new-btn" class="tag-chip${u.open_to_new ? " selected" : ""}" style="margin-top:8px; width:100%; text-align:left;">
      ${t("open_to_new_button")} ${u.open_to_new ? "✓" : ""}
    </button>
    <p style="font-size:12px; color:var(--text-dim); margin:6px 0 0;">
      ${t("open_to_new_text")}
    </p>

    <div class="section-title">${t("age_range_label")}</div>
    <div style="display:flex; gap:10px; align-items:center;">
      <input type="number" id="age-min-input" min="18" max="99" value="${u.seek_age_min ?? 18}" style="width:90px;" />${t("to_separator")}
      <input type="number" id="age-max-input" min="18" max="99" value="${u.seek_age_max ?? 99}" style="width:90px;" />
    </div>

    <button class="btn-primary" id="save-btn" style="margin-top:24px; width:100%;">${t("save_button")}</button>
    <div id="profile-msg" style="margin-top:12px;"></div>

    <div class="section-title">${t("blocked_users_heading")}</div>
    <div id="blocked-box"></div>

    <div class="section-title">${t("help_support_heading")}</div>
    <div id="support-box"></div>

    <div class="section-title">${t("language_heading")}</div>
    <button type="button" id="profile-lang-btn" class="btn-secondary" style="width:100%;">🌐 ${LANG_LABELS[currentLang]}</button>

    <div class="section-title" style="color: var(--danger);">${t("delete_account_heading")}</div>
    <p style="font-size:12px; color:var(--text-dim); margin:0 0 10px;">
      ${t("delete_account_desc")}
    </p>
    <button type="button" id="delete-account-btn" class="btn-secondary" style="width:100%; color: var(--danger); border-color: var(--danger);">
      ${t("delete_account_button")}
    </button>
  `;

  const installBtn = view.querySelector("#install-app-btn");
  if (installBtn) installBtn.onclick = handleInstallClick;

  view.querySelector("#profile-lang-btn").onclick = openLanguageSheet;

  renderPremiumBox(view.querySelector("#premium-box"));
  renderBlockedBox(view.querySelector("#blocked-box"));
  renderSupportBox(view.querySelector("#support-box"));

  const identitySel = new Set(u.identity.map((tag) => tag.id));
  const seekingSel = new Set(u.seeking.map((tag) => tag.id));
  renderGroupedTagPicker(view.querySelector("#identity-picker"), identitySel);
  renderGroupedTagPicker(view.querySelector("#seeking-picker"), seekingSel, { seekingMode: true });

  let openToNew = !!u.open_to_new;
  const openToNewBtn = view.querySelector("#open-to-new-btn");
  openToNewBtn.onclick = () => {
    openToNew = !openToNew;
    openToNewBtn.classList.toggle("selected", openToNew);
    openToNewBtn.innerHTML = `${t("open_to_new_button")} ${openToNew ? "✓" : ""}`;
  };

  const handlePhotoFile = async (file) => {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    const msg = view.querySelector("#profile-msg");
    try {
      const res = await api("/api/me/photo", { method: "POST", body: { dataUrl } });
      state.user.photo_url = res.photo_url;
      render();
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${escapeHtml(errMsg(err))}</div>`;
    }
  };
  view.querySelector("#photo-input-camera").onchange = (e) => handlePhotoFile(e.target.files[0]);
  view.querySelector("#photo-input-gallery").onchange = (e) => handlePhotoFile(e.target.files[0]);
  view.querySelector("#photo-upload").onclick = () => {
    const overlay = document.createElement("div");
    overlay.className = "sheet-overlay";
    overlay.innerHTML = `
      <div class="sheet-box">
        <h3>${t("photo_sheet_title")}</h3>
        <button class="btn-secondary" id="take-photo-btn">${t("take_photo_button")}</button>
        <button class="btn-secondary" id="choose-photo-btn">${t("choose_photo_button")}</button>
        <button class="btn-ghost" id="cancel-photo-btn">${t("cancel")}</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector("#cancel-photo-btn").onclick = () => overlay.remove();
    overlay.querySelector("#take-photo-btn").onclick = () => {
      overlay.remove();
      view.querySelector("#photo-input-camera").click();
    };
    overlay.querySelector("#choose-photo-btn").onclick = () => {
      overlay.remove();
      view.querySelector("#photo-input-gallery").click();
    };
  };

  view.querySelector("#save-btn").onclick = async () => {
    const msg = view.querySelector("#profile-msg");
    msg.innerHTML = "";
    try {
      await api("/api/me", {
        method: "PUT",
        body: {
          name: view.querySelector("#name-input").value.trim(),
          bio: view.querySelector("#bio-input").value.trim(),
          location: view.querySelector("#location-input").value.trim(),
        },
      });
      const updated = await api("/api/me/tags", {
        method: "PUT",
        body: {
          identity: [...identitySel],
          seeking: [...seekingSel],
          openToNew,
          seekAgeMin: view.querySelector("#age-min-input").value,
          seekAgeMax: view.querySelector("#age-max-input").value,
        },
      });
      state.user = updated;
      state.deck = []; // force refresh next time discover is opened
      msg.innerHTML = `<div class="info-msg">${t("saved_success")}</div>`;
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${escapeHtml(errMsg(err))}</div>`;
    }
  };

  view.querySelector("#delete-account-btn").onclick = async () => {
    const typed = prompt(t("delete_confirm_prompt"));
    if (typed !== t("delete_confirm_word")) return;
    const msg = view.querySelector("#profile-msg");
    try {
      await api("/api/me", { method: "DELETE" });
      localStorage.removeItem("tribe_token");
      state.token = null;
      state.user = null;
      alert(t("delete_success_alert"));
      render();
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${escapeHtml(errMsg(err))}</div>`;
    }
  };
}

async function renderPremiumBox(box) {
  const u = state.user;
  box.style.background = "var(--card)";
  box.style.border = "1px solid var(--border)";
  box.style.borderRadius = "16px";
  box.style.padding = "16px";
  box.style.marginBottom = "20px";

  let live = false;
  try {
    const info = await api("/api/premium/info", { auth: false });
    live = !!info.live;
  } catch {}

  const demoSuffix = live ? "" : t("demo_suffix");

  if (u.premium) {
    const localeMap = { de: "de-DE", en: "en-US", pt: "pt-BR" };
    const until = u.premium_until
      ? new Date(u.premium_until).toLocaleDateString(localeMap[currentLang] || "de-DE")
      : "";
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="color: var(--accent3);">${t("premium_active_label")}</strong>
          <div class="preview">${t("premium_active_until", { date: until })}${demoSuffix}</div>
        </div>
        <button class="btn-ghost" id="cancel-premium">${t("cancel_premium_button")}</button>
      </div>
    `;
    box.querySelector("#cancel-premium").onclick = async () => {
      try {
        if (live) {
          const { url } = await api("/api/billing-portal", { method: "POST" });
          window.location.href = url;
        } else {
          state.user = await api("/api/unsubscribe", { method: "POST" });
          state.deck = [];
          render();
        }
      } catch (err) {
        alert(errMsg(err));
      }
    };
  } else {
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
        <div>
          <strong>${t("premium_heading")}</strong>
          <div class="preview">${t("premium_price_text", { price: PREMIUM_PRICE.toFixed(2) })}${demoSuffix}</div>
        </div>
        <button class="btn-primary" id="buy-premium" style="white-space:nowrap;">${t("upgrade_button")}</button>
      </div>
    `;
    box.querySelector("#buy-premium").onclick = async () => {
      try {
        if (live) {
          const { url } = await api("/api/checkout/subscribe", { method: "POST" });
          window.location.href = url;
        } else {
          state.user = await api("/api/subscribe", { method: "POST" });
          state.deck = [];
          render();
        }
      } catch (err) {
        alert(errMsg(err));
      }
    };
  }
}

async function renderBlockedBox(box) {
  box.innerHTML = `<div class="loading">${t("chat_loading")}</div>`;
  try {
    const blocked = await api("/api/blocked");
    if (blocked.length === 0) {
      box.innerHTML = `<p class="preview">${t("no_blocked_users")}</p>`;
      return;
    }
    box.innerHTML = blocked
      .map(
        (u) => `
      <div class="match-row" data-id="${u.id}">
        <div class="avatar" style="${u.photo_url ? `background-image:url(${u.photo_url})` : ""}">${u.photo_url ? "" : "🙂"}</div>
        <div style="flex:1;"><div class="name">${escapeHtml(u.name)}</div></div>
        <button class="btn-ghost unblock-btn">${t("unblock_button")}</button>
      </div>
    `
      )
      .join("");
    box.querySelectorAll(".unblock-btn").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.closest(".match-row").dataset.id;
        await api(`/api/block/${id}`, { method: "DELETE" });
        renderBlockedBox(box);
      };
    });
  } catch {
    box.innerHTML = `<p class="preview">${t("blocked_load_error")}</p>`;
  }
}

async function renderSupportBox(box) {
  box.innerHTML = `
    <form id="support-form" class="field" style="gap:10px;">
      <input type="text" id="support-subject" placeholder="${t("support_subject_placeholder")}" required />
      <textarea id="support-message" rows="3" placeholder="${t("support_message_placeholder")}" required></textarea>
      <button class="btn-secondary" type="submit">${t("send_ticket_button")}</button>
    </form>
    <div id="support-msg" style="margin:10px 0;"></div>
    <div id="support-tickets"></div>
  `;

  box.querySelector("#support-form").onsubmit = async (e) => {
    e.preventDefault();
    const msg = box.querySelector("#support-msg");
    msg.innerHTML = "";
    try {
      await api("/api/support", {
        method: "POST",
        body: {
          subject: box.querySelector("#support-subject").value.trim(),
          message: box.querySelector("#support-message").value.trim(),
        },
      });
      box.querySelector("#support-form").reset();
      msg.innerHTML = `<div class="info-msg">${t("ticket_sent_success")}</div>`;
      await loadAndRenderTickets(box);
    } catch (err) {
      msg.innerHTML = `<div class="error-msg">${escapeHtml(errMsg(err))}</div>`;
    }
  };

  await loadAndRenderTickets(box);
}

async function loadAndRenderTickets(box) {
  const ticketsEl = box.querySelector("#support-tickets");
  try {
    const tickets = await api("/api/support/mine");
    if (tickets.length === 0) {
      ticketsEl.innerHTML = "";
      return;
    }
    ticketsEl.innerHTML =
      `<div class="section-title">${t("your_tickets_heading")}</div>` +
      tickets
        .map(
          (tk) => `
        <div class="match-row" style="align-items:flex-start;">
          <div style="flex:1;">
            <div class="name">${escapeHtml(tk.subject)} <span class="preview">(${tk.status === "open" ? t("status_open") : t("status_closed")})</span></div>
            <div class="preview">${escapeHtml(tk.message)}</div>
            ${tk.reply ? `<div class="info-msg" style="margin-top:6px;">${t("reply_prefix", { reply: escapeHtml(tk.reply) })}</div>` : ""}
          </div>
        </div>
      `
        )
        .join("");
  } catch {
    ticketsEl.innerHTML = "";
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- utils ----------
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------- boot ----------
async function boot() {
  $app.innerHTML = `<div class="loading">${t("chat_loading")}</div>`;
  try {
    state.categories = await api("/api/categories", { auth: false });
  } catch (e) {
    $app.innerHTML = `<div class="loading">${t("backend_unreachable")}</div>`;
    return;
  }
  if (state.token) {
    try {
      state.user = await api("/api/me");
      await loadDeck();
      await confirmCheckoutIfReturning();
    } catch (e) {
      state.token = null;
      state.user = null;
      localStorage.removeItem("tribe_token");
    }
  }
  render();
}

// After Stripe Checkout redirects back with ?checkout=success&session_id=...,
// confirm the payment right away instead of waiting for a webhook (handy for
// local setups without a public URL). Cleans the params off the address bar either way.
async function confirmCheckoutIfReturning() {
  const params = new URLSearchParams(window.location.search);
  const checkout = params.get("checkout");
  const sessionId = params.get("session_id");
  if (checkout === "success" && sessionId) {
    try {
      const result = await api("/api/checkout/confirm", { method: "POST", body: { sessionId } });
      if (result.premium) {
        state.user = await api("/api/me");
      }
    } catch (e) {
      // fall through — user just won't see the instant confirmation
    }
  }
  if (checkout) {
    window.history.replaceState({}, "", window.location.pathname);
  }
}

boot();
